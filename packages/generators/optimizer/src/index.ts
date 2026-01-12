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

  // Clone the frame to avoid mutating the input
  const optimizedRoot = optimizeNode(frame.root, opts) as RootMaterial;

  return {
    ...frame,
    root: optimizedRoot,
  };
}

/**
 * Recursively optimize a node and its children.
 */
function optimizeNode(
  node: FrameNode | RootMaterial,
  options: Required<OptimizationOptions>
): FrameNode | RootMaterial {
  // Handle nodes with children
  if ("children" in node && node.children) {
    let children = node.children.map((child) => optimizeNode(child, options));

    // Apply optimizations to the children array
    if (options.mergeTransforms) {
      children = mergeTransforms(children);
    }

    if (options.squashMaterials) {
      children = squashMaterials(children);
    }

    if (options.removeIdentityTransforms) {
      children = removeIdentityTransforms(children);
    }

    return { ...node, children };
  }

  // Leaf nodes (shapes) pass through unchanged
  return node;
}

/**
 * Merge sequential Transform nodes where no Material boundary exists.
 *
 * Transform(A) -> Transform(B) -> children
 * becomes
 * Transform(A * B) -> children
 */
function mergeTransforms(children: FrameNode[]): FrameNode[] {
  const result: FrameNode[] = [];

  for (const node of children) {
    if (node.type === "transform") {
      // Check if the transform has a single child that is also a transform
      if (node.children.length === 1 && node.children[0].type === "transform") {
        const childTransform = node.children[0] as Transform;
        // Merge the matrices
        const mergedMatrix = multiplyMatrices(
          node.matrix,
          childTransform.matrix
        );
        // Create merged transform with grandchildren
        const merged: Transform = {
          type: "transform",
          matrix: mergedMatrix,
          children: childTransform.children,
        };
        // Recursively try to merge more
        result.push(...mergeTransforms([merged]));
      } else {
        // Can't merge, but recurse into children
        result.push({
          ...node,
          children: mergeTransforms(node.children),
        });
      }
    } else if (node.type === "material" && "children" in node) {
      // Material boundary - recurse into children separately
      result.push({
        ...node,
        children: mergeTransforms(node.children),
      } as FrameNode);
    } else {
      // Shape or other node - pass through
      result.push(node);
    }
  }

  return result;
}

/**
 * Squash sequential ChildMaterial nodes where safe.
 *
 * CRITICAL: A material can only be squashed if NO descendant references it by ID.
 *
 * ChildMaterial(id: "m1", ref: "root", fill: "red")
 *   ChildMaterial(id: "m2", ref: "m1", stroke: "blue")
 *     Circle
 *
 * becomes (if m1 is not referenced by any other descendant):
 *
 * ChildMaterial(id: "m2", ref: "root", fill: "red", stroke: "blue")
 *   Circle
 */
function squashMaterials(children: FrameNode[]): FrameNode[] {
  const result: FrameNode[] = [];

  for (const node of children) {
    if (node.type === "material" && "ref" in node) {
      const material = node as ChildMaterial;

      // Check if single child is also a ChildMaterial that refs this material
      if (
        material.children.length === 1 &&
        material.children[0].type === "material" &&
        "ref" in material.children[0]
      ) {
        const childMaterial = material.children[0] as ChildMaterial;

        // Child must reference this material
        if (childMaterial.ref === material.id) {
          // Check if any OTHER descendant references this material
          const descendantRefs = collectDescendantRefs(childMaterial.children);

          if (!descendantRefs.has(material.id)) {
            // Safe to squash: merge parent's overrides into child
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
              // Child's overrides take precedence
              ...(childMaterial.fill !== undefined && {
                fill: childMaterial.fill,
              }),
              ...(childMaterial.stroke !== undefined && {
                stroke: childMaterial.stroke,
              }),
              ...(childMaterial.strokeWidth !== undefined && {
                strokeWidth: childMaterial.strokeWidth,
              }),
              children: squashMaterials(childMaterial.children),
            };
            result.push(squashed);
            continue;
          }
        }
      }

      // Can't squash - recurse into children
      result.push({
        ...material,
        children: squashMaterials(material.children),
      });
    } else if ("children" in node && node.children) {
      // Other node with children - recurse
      result.push({
        ...node,
        children: squashMaterials(node.children),
      } as FrameNode);
    } else {
      // Leaf node - pass through
      result.push(node);
    }
  }

  return result;
}

/**
 * Collect all material IDs referenced by ref properties in descendants.
 */
function collectDescendantRefs(nodes: FrameNode[]): Set<string> {
  const refs = new Set<string>();

  function visit(node: FrameNode): void {
    if (node.type === "material" && "ref" in node) {
      refs.add((node as ChildMaterial).ref);
    }
    if ("children" in node && node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return refs;
}

/**
 * Remove Transform nodes with identity matrix, promoting their children.
 */
function removeIdentityTransforms(children: FrameNode[]): FrameNode[] {
  const result: FrameNode[] = [];

  for (const node of children) {
    if (node.type === "transform") {
      if (isIdentityMatrix(node.matrix)) {
        // Identity transform - promote children
        result.push(...removeIdentityTransforms(node.children));
      } else {
        // Non-identity - keep but recurse
        result.push({
          ...node,
          children: removeIdentityTransforms(node.children),
        });
      }
    } else if ("children" in node && node.children) {
      // Other node with children - recurse
      result.push({
        ...node,
        children: removeIdentityTransforms(node.children),
      } as FrameNode);
    } else {
      // Leaf node - pass through
      result.push(node);
    }
  }

  return result;
}
