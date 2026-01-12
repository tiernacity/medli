# generator-optimizer Agent Instructions

## Your Role

You maintain the **OptimizerGenerator** - a pipeline generator that optimizes Frame IR.

**Visual correctness is non-negotiable.** Optimizations must preserve exact visual output.

## Architecture

The optimizer uses a **bottom-up traversal** pattern with structural sharing:

### Core Types

```typescript
// Result type enables structural sharing
type OptimizeResult = {
  node: FrameNode | RootMaterial;
  meta: NodeMetadata;
  changed: boolean;
};

// Metadata propagated bottom-up for O(1) ref lookups
interface NodeMetadata {
  descendantRefs: Set<string>;  // All material refs from this subtree
}
```

### Key Design Principles

1. **Bottom-up traversal** - Optimize children first, then apply parent optimizations
2. **O(1) ref lookups** - `NodeMetadata.descendantRefs` aggregates refs from children's subtrees
3. **Structural sharing** - Returns same reference when unchanged (`changed: boolean` flag)
4. **Lazy array allocation** - Helper functions only allocate when modifications are needed

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | OptimizerGenerator, optimizeFrame, optimization functions |
| `src/__tests__/optimizer.test.ts` | 38 comprehensive tests covering all optimization paths |

## Optimizations

### 1. Transform Merging (`mergeTransformsLazy`)

Sequential Transform nodes with no Material boundary can be merged via matrix multiplication. Uses **iterative chain merging** with lazy array allocation.

```
Transform(A) -> Transform(B) -> Circle
becomes
Transform(A * B) -> Circle
```

**Constraint:** Material boundaries block merging.

### 2. Material Squashing (`trySquashMaterial`)

Sequential ChildMaterials where parent has single child can merge.

**CRITICAL:** Uses the **child's `descendantRefs`**, not `aggregateRefs`. This prevents the bug where aggregateRefs includes the direct child's ref, causing squash to always fail.

Example that CAN be squashed:
```
ChildMaterial(id: "m1", ref: "root", fill: "red")
  ChildMaterial(id: "m2", ref: "m1", stroke: "blue")
    Circle
```

Example that CANNOT be squashed (m3 references m1):
```
ChildMaterial(id: "m1", ref: "root", fill: "red")
  ChildMaterial(id: "m2", ref: "m1", stroke: "blue")
    ChildMaterial(id: "m3", ref: "m1", ...)
      Circle
```

### 3. Identity Transform Removal (`removeIdentitiesLazy`)

Transform nodes with identity matrix `[1,0,0,1,0,0]` can be unwrapped, promoting their children. Uses **lazy array allocation** - only creates new array when a removal occurs.

## Performance

| Metric | Previous | Current | Improvement |
|--------|----------|---------|-------------|
| 500 shapes | 46ms/frame | ~3.5ms/frame | **13x faster** |

**Key optimizations:**
- **O(1) ref lookups** - `descendantRefs` computed once per subtree, not re-traversed
- **Lazy allocation** - Arrays only allocated when modifications are made
- **Structural sharing** - Unchanged subtrees reuse original references

## Constraints

- **Visual equivalence is mandatory** - optimized output must render identically
- Material inheritance semantics must be preserved
- Transform accumulation order must be preserved
- No mutations to input Frame (always clone when modifying)

## When Reviewing Changes

- Does optimization preserve visual output?
- Are material ref constraints checked correctly?
- Is transform multiplication order correct (a * b means b applied first)?
- Are edge cases handled (empty children, deep nesting)?
- Is lazy allocation used (avoid allocating until necessary)?
- Does structural sharing work (unchanged nodes return same reference)?

## After Changes

```bash
npm run typecheck
npm run test
cd packages/test-app && npm run dev  # Visual verification
```
