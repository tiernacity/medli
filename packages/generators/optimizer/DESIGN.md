# Optimizer Redesign: Implementation Plan

**Status:** Ready for implementation
**Branch:** `feat/frame-validation-and-optimisation`
**Decision Graph Node:** 600

## Problem Statement

The current optimizer adds **46ms per frame** with 500 shapes. Target is **<1ms** (comparable to no optimizer).

### Root Cause

1. **O(n²) complexity** - `collectDescendantRefs` traverses subtree for EACH ChildMaterial
2. **4 passes per level** - optimizeNode + mergeTransforms + squashMaterials + removeIdentityTransforms
3. **Unconditional cloning** - `{ ...node, children }` creates objects even when nothing changed

## Synthesized Design

Combines insights from three competing design proposals:

- **Agent A:** Bottom-up visitor with `OptimizeResult` type
- **Agent B:** Iterative transform chain merging, lazy array allocation
- **Agent C:** Aggregated `descendantRefs` propagated bottom-up

### Core Architecture

```typescript
// Result type for structural sharing
type OptimizeResult = {
  node: FrameNode | RootMaterial;
  meta: NodeMetadata;
  changed: boolean;
};

// Metadata propagated bottom-up
interface NodeMetadata {
  descendantRefs: Set<string>;  // All material refs from this subtree
}

const EMPTY_SET: ReadonlySet<string> = Object.freeze(new Set());
```

### Main Algorithm

```typescript
function optimizeNode(
  node: FrameNode | RootMaterial,
  options: Required<OptimizationOptions>
): OptimizeResult {
  // Leaf nodes: return immediately
  if (!("children" in node) || !node.children || node.children.length === 0) {
    return { node, meta: { descendantRefs: EMPTY_SET }, changed: false };
  }

  // 1. Recurse children first (bottom-up)
  const childResults = node.children.map(child => optimizeNode(child, options));

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
  const anyChildChanged = childResults.some(r => r.changed);
  let children = anyChildChanged
    ? childResults.map(r => r.node as FrameNode)
    : node.children;  // SAME REFERENCE if no changes

  let modified = anyChildChanged;

  // 4. Apply optimizations with O(1) ref lookups

  // Transform merging (iterative chain merge)
  if (options.mergeTransforms) {
    const [merged, didMerge] = mergeTransformsLazy(children);
    if (didMerge) { children = merged; modified = true; }
  }

  // Material squashing (uses child's descendantRefs, NOT aggregateRefs)
  if (options.squashMaterials && node.type === "material" && "ref" in node) {
    const squashed = trySquashMaterial(
      node as ChildMaterial,
      children,
      childResults  // Pass child results for correct ref check
    );
    if (squashed) return squashed;
  }

  // Identity transform removal
  if (options.removeIdentityTransforms) {
    const [filtered, didRemove] = removeIdentitiesLazy(children);
    if (didRemove) { children = filtered; modified = true; }
  }

  // 5. Structural sharing: return same reference if unchanged
  if (!modified) {
    return { node, meta: { descendantRefs: aggregateRefs }, changed: false };
  }

  return {
    node: { ...node, children },
    meta: { descendantRefs: aggregateRefs },
    changed: true
  };
}
```

### Transform Merging (Iterative)

```typescript
function mergeTransformsLazy(children: FrameNode[]): [FrameNode[], boolean] {
  let result: FrameNode[] | null = null;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === "transform" &&
        child.children.length === 1 &&
        child.children[0].type === "transform") {

      if (!result) result = children.slice(0, i);

      // Iterative chain merge
      let current = child as Transform;
      let matrix = current.matrix;
      while (current.children.length === 1 &&
             current.children[0].type === "transform") {
        const next = current.children[0] as Transform;
        matrix = multiplyMatrices(matrix, next.matrix);
        current = next;
      }

      result.push({
        type: "transform",
        matrix,
        children: current.children
      });
    } else if (result) {
      result.push(child);
    }
  }

  return result ? [result, true] : [children, false];
}
```

### Material Squashing (Corrected)

```typescript
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
    ref: material.ref,  // Point to grandparent
    // Parent's overrides first, then child's overrides on top
    ...(material.fill !== undefined && { fill: material.fill }),
    ...(material.stroke !== undefined && { stroke: material.stroke }),
    ...(material.strokeWidth !== undefined && { strokeWidth: material.strokeWidth }),
    ...(childMaterial.fill !== undefined && { fill: childMaterial.fill }),
    ...(childMaterial.stroke !== undefined && { stroke: childMaterial.stroke }),
    ...(childMaterial.strokeWidth !== undefined && { strokeWidth: childMaterial.strokeWidth }),
    children: childMaterial.children,
  };

  return {
    node: squashed,
    meta: { descendantRefs: childDescendantRefs },
    changed: true
  };
}
```

### Identity Transform Removal

```typescript
function removeIdentitiesLazy(children: FrameNode[]): [FrameNode[], boolean] {
  let result: FrameNode[] | null = null;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === "transform" && isIdentityMatrix(child.matrix)) {
      // Identity - promote its children
      if (!result) result = children.slice(0, i);
      result.push(...child.children);  // Splice in grandchildren
    } else if (result) {
      result.push(child);
    }
  }

  return result ? [result, true] : [children, false];
}
```

---

## Test Suite

### 1. Optimizations ARE Applied

These tests verify optimizations trigger when conditions are met.

#### Transform Merging

```typescript
// T1: Simple chain merge
// Input:  Transform(A) -> Transform(B) -> Circle
// Output: Transform(A*B) -> Circle
test("merges two sequential transforms");

// T2: Deep chain merge
// Input:  Transform(A) -> Transform(B) -> Transform(C) -> Transform(D) -> Circle
// Output: Transform(A*B*C*D) -> Circle
test("merges deep transform chain");

// T3: Multiple siblings with chains
// Input:  [Transform(A) -> Transform(B) -> Circle1, Transform(C) -> Transform(D) -> Circle2]
// Output: [Transform(A*B) -> Circle1, Transform(C*D) -> Circle2]
test("merges independent sibling chains");
```

#### Material Squashing

```typescript
// M1: Simple squash
// Input:  ChildMaterial(id="m1", ref="root") -> ChildMaterial(id="m2", ref="m1") -> Circle
// Output: ChildMaterial(id="m2", ref="root", merged styles) -> Circle
test("squashes parent-child materials when safe");

// M2: Deep squash chain
// Input:  M1 -> M2(ref=m1) -> M3(ref=m2) -> Circle
// Output: M3(ref=root, all styles merged) -> Circle
test("squashes multiple levels bottom-up");

// M3: Style override precedence
// Input:  M1(fill="red") -> M2(ref=m1, fill="blue") -> Circle
// Output: M2(ref=root, fill="blue") -> Circle  // Child wins
test("child material overrides parent styles");
```

#### Identity Transform Removal

```typescript
// I1: Simple identity removal
// Input:  Transform(identity) -> Circle
// Output: Circle (promoted)
test("removes identity transform and promotes children");

// I2: Chain of identities
// Input:  Transform(identity) -> Transform(identity) -> Circle
// Output: Circle
test("removes multiple identity transforms");

// I3: Identity with multiple children
// Input:  Transform(identity) -> [Circle1, Circle2, Circle3]
// Output: [Circle1, Circle2, Circle3] (all promoted)
test("promotes all children when identity removed");

// I4: Nested identity
// Input:  Transform(A) -> Transform(identity) -> Transform(B) -> Circle
// Output: Transform(A) -> Transform(B) -> Circle
// Then:   Transform(A*B) -> Circle (after merge pass)
test("identity removal enables further transform merging");
```

### 2. Functional Equivalence

These tests verify optimized output renders identically to unoptimized.

#### Transform Correctness

```typescript
// E1: Matrix multiplication order
// Verify: Transform(A) -> Transform(B) applied to point P
//         equals Transform(A*B) applied to P
test("merged transform produces same coordinates");

// E2: Complex transform chain
// Input:  Translate(10,0) -> Rotate(90deg) -> Scale(2,2) -> Circle(0,0,5)
// Verify: Circle renders at same position with merged transform
test("complex transform chain renders equivalently");

// E3: Transform with multiple shapes
// Input:  Transform(A) -> Transform(B) -> [Circle1, Circle2]
// Verify: Both shapes transform correctly after merge
test("merged transform applies correctly to all children");
```

#### Material Correctness

```typescript
// E4: Style inheritance after squash
// Input:  Root(fill="red", stroke="black", strokeWidth=1)
//         -> M1(fill="blue")
//         -> M2(ref=m1, stroke="white")
//         -> Circle
// Verify: Circle has fill="blue", stroke="white", strokeWidth=1
test("squashed material resolves styles correctly");

// E5: Partial override preservation
// Input:  M1(fill="red", stroke="black") -> M2(ref=m1, fill="blue") -> Circle
// Verify: After squash, stroke="black" preserved from M1
test("unoverridden properties preserved after squash");
```

#### Round-Trip Verification

```typescript
// E6: optimize(frame) renders same as frame
test("optimized frame renders identically to original", async () => {
  const original = generator.frame(context);
  const optimized = optimizeFrame(original);

  const originalPixels = await renderToPixels(original);
  const optimizedPixels = await renderToPixels(optimized);

  expect(optimizedPixels).toEqual(originalPixels);
});

// E7: Idempotence
test("optimize(optimize(frame)) === optimize(frame)");
```

### 3. Optimizations NOT Applied

These tests verify optimizations are correctly skipped when conditions aren't met.

#### Transform Merge Blocked

```typescript
// B1: Material boundary blocks merge
// Input:  Transform(A) -> Material -> Transform(B) -> Circle
// Output: Same (no merge across material boundary)
test("does not merge transforms across material boundary");

// B2: Multi-child transform
// Input:  Transform(A) -> [Circle1, Circle2]
// Output: Same (can't merge, has multiple children)
test("does not merge transform with multiple children");

// B3: Non-transform child
// Input:  Transform(A) -> Circle
// Output: Same (child is shape, not transform)
test("does not merge when child is not a transform");
```

#### Material Squash Blocked

```typescript
// B4: Descendant refs parent - classic case
// Input:  M1 -> M2(ref=m1) -> M3(ref=m1) -> Circle
// Output: Same (M3 references M1, can't squash M1)
test("does not squash when descendant references parent");

// B5: Deep descendant refs parent
// Input:  M1 -> M2(ref=m1) -> Transform -> M3(ref=m1) -> Circle
// Output: Same (M3 still refs M1 through transform)
test("does not squash when deep descendant references parent");

// B6: Multiple children
// Input:  M1 -> [M2(ref=m1) -> Circle1, M3(ref=m1) -> Circle2]
// Output: Same (M1 has multiple children)
test("does not squash when parent has multiple children");

// B7: Child refs different ancestor
// Input:  M1 -> M2(ref=root) -> Circle
// Output: Same (M2 doesn't ref M1)
test("does not squash when child refs different ancestor");

// B8: Sibling refs parent
// Input:  M1 -> M2(ref=m1) -> [Circle, M3(ref=m1) -> Square]
// Output: Same (M3 refs M1, blocking squash)
test("does not squash when sibling subtree references parent");
```

#### Identity Removal Blocked

```typescript
// B9: Non-identity transform preserved
// Input:  Transform(non-identity) -> Circle
// Output: Same
test("does not remove non-identity transform");

// B10: Near-identity preserved
// Input:  Transform([1.0001, 0, 0, 1, 0, 0]) -> Circle
// Output: Same (not exactly identity)
test("does not remove near-identity transform");
```

### 4. Edge Cases

```typescript
// EC1: Empty children
test("handles empty children array");

// EC2: Deeply nested (stack safety)
test("handles 1000-deep nesting without stack overflow");

// EC3: Large flat tree (performance)
test("handles 500 shapes in <1ms", async () => {
  const frame = generateStressFrame(500);
  const start = performance.now();
  optimizeFrame(frame);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(1);
});

// EC4: No optimizations possible
test("returns same reference when no optimizations apply");

// EC5: All optimizations apply
test("applies all three optimizations in single pass");

// EC6: Structural sharing verification
test("unchanged subtrees share references with input");
```

### 5. Regression Tests

```typescript
// R1: The aggregateRefs bug (issue found during validation)
test("squashes material when only direct child refs parent", () => {
  // This was broken before the fix
  const frame = {
    root: {
      type: "material", id: "root", fill: "red", stroke: "black", strokeWidth: 1,
      children: [{
        type: "material", id: "m1", ref: "root", fill: "blue",
        children: [{
          type: "material", id: "m2", ref: "m1",
          children: [{ type: "circle", center: {x:0,y:0}, radius: 5 }]
        }]
      }]
    }
  };

  const optimized = optimizeFrame(frame);

  // Should squash to single material
  expect(optimized.root.children[0].id).toBe("m2");
  expect(optimized.root.children[0].ref).toBe("root");
});
```

---

## Pipeline Requirements

### Standard Pipeline Order

```
Generator → Validator → Optimizer → Validator → Renderer
              ↑                        ↑
         validate input         validate output (LAST before render)
```

### Why Validator Last?

1. **Catch optimizer bugs** - If optimizer produces invalid Frame, we catch it
2. **Guarantee renderer input** - Renderer always receives valid Frame
3. **Debug visibility** - Invalid frames fail fast with clear error

### Pipeline Factory

```typescript
// Recommended pipeline construction
function createPipeline(generator: Generator): Generator {
  return withValidation(      // Validator LAST
    withOptimization(         // Optimizer
      withValidation(generator)  // Validator FIRST (validate generator output)
    )
  );
}

// Or with options
function createPipeline(generator: Generator, options?: PipelineOptions): Generator {
  let pipeline = generator;

  if (options?.validateInput !== false) {
    pipeline = withValidation(pipeline);
  }

  if (options?.optimize !== false) {
    pipeline = withOptimization(pipeline, options?.optimizerOptions);
  }

  // ALWAYS validate before render (unless explicitly disabled for perf testing)
  if (options?.validateOutput !== false) {
    pipeline = withValidation(pipeline);
  }

  return pipeline;
}
```

### Files to Update

All demo/harness files should use the standard pipeline:

1. `packages/test-app/src/harness.ts`
2. `packages/test-app/src/full-screen.ts`
3. `packages/test-app/src/benchmark.ts`
4. Any other files using generators directly

---

## Implementation Checklist

### Phase 1: Core Optimizer

- [ ] Implement `OptimizeResult` and `NodeMetadata` types
- [ ] Implement `optimizeNode` with bottom-up traversal
- [ ] Implement `mergeTransformsLazy`
- [ ] Implement `trySquashMaterial` (with correct ref check)
- [ ] Implement `removeIdentitiesLazy`
- [ ] Update `optimizeFrame` to use new implementation
- [ ] Preserve API: `OptimizerGenerator`, `withOptimization`, `optimizeFrame`

### Phase 2: Test Suite

- [ ] Add tests for optimizations applied (T1-T3, M1-M3, I1-I4)
- [ ] Add tests for functional equivalence (E1-E7)
- [ ] Add tests for optimizations blocked (B1-B10)
- [ ] Add edge case tests (EC1-EC6)
- [ ] Add regression test for aggregateRefs bug (R1)

### Phase 3: Pipeline Integration

- [ ] Update harness.ts to use validator-optimizer-validator pipeline
- [ ] Update full-screen.ts to use standard pipeline
- [ ] Update benchmark.ts to use standard pipeline
- [ ] Verify all demos work with pipeline

### Phase 4: Performance Validation

- [ ] Run benchmark with 500 shapes
- [ ] Verify <1ms optimizer time
- [ ] Compare before/after metrics
- [ ] Document performance improvement

### Phase 5: Cleanup

- [ ] Update AGENT.md with new architecture
- [ ] Update decision graph with outcome
- [ ] Sync decision graph (`deciduous sync`)
- [ ] Push changes

---

## Performance Target

| Metric | Current | Target | Rationale |
|--------|---------|--------|-----------|
| 500 shapes | 46ms | <1ms | Match no-optimizer baseline |
| 1000 shapes | ~90ms | <2ms | Linear scaling |
| Structural no-op | 46ms | <0.2ms | Return same reference |

---

## References

- Decision graph node: 600 (goal), 601-603 (actions/observations)
- Branch: `feat/frame-validation-and-optimisation`
- Validation agents identified bug in node 602
