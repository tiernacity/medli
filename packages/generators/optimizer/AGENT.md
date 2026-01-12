# generator-optimizer Agent Instructions

## Your Role

You maintain the **OptimizerGenerator** - a pipeline generator that optimizes Frame IR.

**Visual correctness is non-negotiable.** Optimizations must preserve exact visual output.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | OptimizerGenerator, optimizeFrame, optimization functions |

## Optimizations

### 1. Transform Merging
Sequential Transform nodes with no Material boundary can be merged via matrix multiplication.

```
Transform(A) -> Transform(B) -> Circle
becomes
Transform(A * B) -> Circle
```

**Constraint:** Material boundaries block merging.

### 2. Material Squashing
Sequential ChildMaterials where parent has single child can merge.

**CRITICAL CONSTRAINT:** A material can only be squashed if NO descendant references it by ID.

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

### 3. Identity Transform Removal
Transform nodes with identity matrix `[1,0,0,1,0,0]` can be unwrapped, promoting their children.

## Constraints

- **Visual equivalence is mandatory** - optimized output must render identically
- Material inheritance semantics must be preserved
- Transform accumulation order must be preserved
- No mutations to input Frame (always clone)

## When Reviewing Changes

- Does optimization preserve visual output?
- Are material ref constraints checked correctly?
- Is transform multiplication order correct (a * b means b applied first)?
- Are edge cases handled (empty children, deep nesting)?

## After Changes

```bash
npm run typecheck
npm run test
cd packages/test-app && npm run dev  # Visual verification
```
