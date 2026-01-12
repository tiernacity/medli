import type {
  Frame,
  Generator,
  RenderContext,
  FrameNode,
  Transform,
  ChildMaterial,
  RootMaterial,
} from "@medli/spec";
import { multiplyMatrices, isIdentityMatrix } from "@medli/generator-utils";

/**
 * Options for frame optimization.
 */
export interface OptimizationOptions {
  /** Merge sequential Transform nodes (default: true) */
  mergeTransforms?: boolean;
  /** Merge sequential ChildMaterial nodes where safe (default: true) */
  squashMaterials?: boolean;
  /** Remove identity transform nodes (default: true) */
  removeIdentityTransforms?: boolean;
}

const defaultOptions: Required<OptimizationOptions> = {
  mergeTransforms: true,
  squashMaterials: true,
  removeIdentityTransforms: true,
};

// Result type for structural sharing
type OptimizeResult = {
  node: FrameNode | RootMaterial;
  meta: NodeMetadata;
  changed: boolean;
};

interface NodeMetadata {
  descendantRefs: Set<string>; // All material refs from this subtree
}

const EMPTY_SET: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * A pipeline generator that optimizes frames from an upstream generator.
 *
 * Applies various optimizations to reduce Frame IR complexity:
 * - Merge sequential Transform nodes via matrix multiplication
 * - Squash sequential ChildMaterial nodes where safe
 * - Remove identity transform nodes
 *
 * @example
 * ```typescript
 * const gen = new ProceduralGenerator(draw);
 * const optimized = new OptimizerGenerator(gen);
 * // or use the factory function:
 * const optimized = withOptimization(gen);
 * ```
 */
export class OptimizerGenerator implements Generator {
  private readonly options: Required<OptimizationOptions>;

  constructor(
    private readonly upstream: Generator,
    options?: OptimizationOptions
  ) {
    this.options = { ...defaultOptions, ...options };
  }

  frame(context: RenderContext): Frame {
    const frame = this.upstream.frame(context);
    return optimizeFrame(frame, this.options);
  }
}

/**
 * Factory function to wrap a generator with optimization.
 */
export function withOptimization(
  generator: Generator,
  options?: OptimizationOptions
): OptimizerGenerator {
  return new OptimizerGenerator(generator, options);
}

/**
 * Optimize a Frame IR tree.
 *
 * This is the standalone optimization function, useful for testing
 * or when you have a Frame directly without a generator.
 */
export function optimizeFrame(
  frame: Frame,
  options?: OptimizationOptions
): Frame {
  const opts = { ...defaultOptions, ...options };

  // Use new bottom-up optimizer and extract just the node
  const result = optimizeNode(frame.root, opts);

  // Structural sharing: return same frame if unchanged
  if (!result.changed) {
    return frame;
  }

  return {
    ...frame,
    root: result.node as RootMaterial,
  };
}

/**
 * Recursively optimize a node and its children (bottom-up).
 *
 * Returns OptimizeResult with:
 * - node: The optimized node (same reference if unchanged)
 * - meta: Metadata including descendantRefs for O(1) ref lookups
 * - changed: Whether any optimization was applied
 */
function optimizeNode(
  node: FrameNode | RootMaterial,
  options: Required<OptimizationOptions>
): OptimizeResult {
  // Leaf nodes: return immediately with empty refs
  if (!("children" in node) || !node.children || node.children.length === 0) {
    return {
      node,
      meta: { descendantRefs: EMPTY_SET as Set<string> },
      changed: false,
    };
  }

  // 1. Recurse children first (bottom-up)
  const childResults = node.children.map((child) =>
    optimizeNode(child, options)
  );

  // 2. Aggregate descendantRefs from children's subtrees
  //    CRITICAL: Do NOT include direct children's refs here
  const aggregateRefs = new Set<string>();
  for (const result of childResults) {
    for (const ref of result.meta.descendantRefs) {
      aggregateRefs.add(ref);
    }
  }
  // Add direct children's refs (for parent's aggregateRefs, NOT for our squash check)
  for (const child of node.children) {
    if (child.type === "material" && "ref" in child) {
      aggregateRefs.add((child as ChildMaterial).ref);
    }
  }

  // 3. Check if any child changed
  const anyChildChanged = childResults.some((r) => r.changed);
  let children = anyChildChanged
    ? childResults.map((r) => r.node as FrameNode)
    : node.children; // SAME REFERENCE if no changes

  let modified = anyChildChanged;

  // 4. Apply optimizations with O(1) ref lookups

  // Transform merging (iterative chain merge)
  if (options.mergeTransforms) {
    const [merged, didMerge] = mergeTransformsLazy(children);
    if (didMerge) {
      children = merged;
      modified = true;
    }
  }

  // Material squashing (uses child's descendantRefs, NOT aggregateRefs)
  if (options.squashMaterials && node.type === "material" && "ref" in node) {
    const squashed = trySquashMaterial(
      node as ChildMaterial,
      children,
      childResults // Pass child results for correct ref check
    );
    if (squashed) return squashed;
  }

  // Identity transform removal
  if (options.removeIdentityTransforms) {
    const [filtered, didRemove] = removeIdentitiesLazy(children);
    if (didRemove) {
      children = filtered;
      modified = true;
    }
  }

  // 5. Structural sharing: return same reference if unchanged
  if (!modified) {
    return { node, meta: { descendantRefs: aggregateRefs }, changed: false };
  }

  return {
    node: { ...node, children },
    meta: { descendantRefs: aggregateRefs },
    changed: true,
  };
}

/**
 * Merge sequential Transform nodes where no Material boundary exists.
 * Uses iterative chain merging and lazy array allocation.
 *
 * Transform(A) -> Transform(B) -> children
 * becomes
 * Transform(A * B) -> children
 *
 * Returns [children, didMerge] tuple.
 */
function mergeTransformsLazy(children: FrameNode[]): [FrameNode[], boolean] {
  let result: FrameNode[] | null = null;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (
      child.type === "transform" &&
      child.children.length === 1 &&
      child.children[0].type === "transform"
    ) {
      // Lazy allocation: only clone when we find something to merge
      if (!result) result = children.slice(0, i);

      // Iterative chain merge
      let current = child as Transform;
      let matrix = current.matrix;
      while (
        current.children.length === 1 &&
        current.children[0].type === "transform"
      ) {
        const next = current.children[0] as Transform;
        matrix = multiplyMatrices(matrix, next.matrix);
        current = next;
      }

      result.push({
        type: "transform",
        matrix,
        children: current.children,
      });
    } else if (result) {
      result.push(child);
    }
  }

  return result ? [result, true] : [children, false];
}

/**
 * Try to squash a ChildMaterial with its single ChildMaterial child.
 *
 * CRITICAL: Uses the CHILD's descendantRefs, not aggregateRefs.
 * This fixes the bug where aggregateRefs includes the direct child's ref,
 * causing squash to ALWAYS fail.
 *
 * Returns OptimizeResult if squashed, null otherwise.
 */
function trySquashMaterial(
  material: ChildMaterial,
  children: FrameNode[],
  childResults: OptimizeResult[]
): OptimizeResult | null {
  if (children.length !== 1) return null;

  const child = children[0];
  if (child.type !== "material" || !("ref" in child)) return null;

  const childMaterial = child as ChildMaterial;
  if (childMaterial.ref !== material.id) return null;

  // CRITICAL: Use the CHILD's descendantRefs, not aggregateRefs
  // This contains refs from grandchildren and below, NOT the child's own ref
  const childDescendantRefs = childResults[0].meta.descendantRefs;
  if (childDescendantRefs.has(material.id)) return null;

  // Safe to squash
  const squashed: ChildMaterial = {
    type: "material",
    id: childMaterial.id,
    ref: material.ref, // Point to grandparent
    // Parent's overrides first, then child's overrides on top
    ...(material.fill !== undefined && { fill: material.fill }),
    ...(material.stroke !== undefined && { stroke: material.stroke }),
    ...(material.strokeWidth !== undefined && {
      strokeWidth: material.strokeWidth,
    }),
    ...(childMaterial.fill !== undefined && { fill: childMaterial.fill }),
    ...(childMaterial.stroke !== undefined && { stroke: childMaterial.stroke }),
    ...(childMaterial.strokeWidth !== undefined && {
      strokeWidth: childMaterial.strokeWidth,
    }),
    children: childMaterial.children,
  };

  return {
    node: squashed,
    meta: { descendantRefs: childDescendantRefs },
    changed: true,
  };
}

/**
 * Remove Transform nodes with identity matrix, promoting their children.
 * Uses lazy array allocation.
 *
 * Returns [children, didRemove] tuple.
 */
function removeIdentitiesLazy(children: FrameNode[]): [FrameNode[], boolean] {
  let result: FrameNode[] | null = null;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === "transform" && isIdentityMatrix(child.matrix)) {
      // Identity - promote its children
      if (!result) result = children.slice(0, i);
      result.push(...child.children); // Splice in grandchildren
    } else if (result) {
      result.push(child);
    }
  }

  return result ? [result, true] : [children, false];
}
