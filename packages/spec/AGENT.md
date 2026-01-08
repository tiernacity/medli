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

## After Changes

```bash
npm run typecheck   # Changes affect all packages
npm run test        # Validation tests pass
```
