# spec Agent Instructions

## Your Role

You maintain the **Frame spec** - the intermediate representation (IR) that is the contract between generators and renderers.

**Your job is to:**
- Define types that are simple to validate (single-pass, no cycles)
- Provide validation utilities (validateFrame, resolveMaterial)
- Keep the IR minimal - only what renderers need to draw

**Correctness is non-negotiable.** Changes here affect ALL packages.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | All type definitions and validation functions |

## Constraints

- **Types only** - no rendering logic, no generator logic
- **Validation is single-pass** - top-down tree traversal
- **Shapes are leaves** - pure geometry, no style properties
- **Materials provide style** - inheritance via tree structure
- **Transforms use matrices** - 6-value 2D affine `[a,b,c,d,e,f]`

## Materials vs Transforms

| Concern | Materials | Transforms |
|---------|-----------|------------|
| Behavior | **Inherit** with overrides | **Accumulate** via multiplication |
| ID | Required (for ref) | None needed |
| Nesting | Can nest with anything | Can nest with anything |

Generator APIs (translate/rotate/scale) compose into matrices. The IR only stores matrices.

## When Reviewing Changes

- Does the change maintain single-pass validation?
- Are all types exported?
- Does validateFrame() catch the new edge cases?
- Will this break existing generators or renderers?

## When Adding Shape Types

1. Add type definition with `type` discriminator
2. Add to `Shape` union type
3. Update `FrameNode` if needed
4. No validation changes needed (shapes are leaves)

## When Adding Transform Type

1. Define `Transform` with `type: 'transform'` and `matrix: Matrix2D`
2. Define `Matrix2D` as 6-element tuple `[a, b, c, d, e, f]`
3. Add Transform to `FrameNode` union
4. Update validateFrame() to check matrix has 6 numbers
5. **No id required** - transforms don't need references

## After Changes

```bash
npm run typecheck   # Changes affect all packages
npm run test        # Validation tests pass
```
