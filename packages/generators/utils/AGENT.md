# generator-utils Agent Instructions

## Your Role

You maintain **shared utilities** for all medli generators - primarily matrix math operations.

**Correctness is non-negotiable.** These utilities are foundational.

## Key Files

| File | Purpose |
|------|---------|
| `src/matrix.ts` | 2D affine matrix operations |

## Matrix Format

2D affine matrix as 6-value array: `[a, b, c, d, e, f]`

Represents:
```
| a  c  e |
| b  d  f |
| 0  0  1 |
```

- Identity: `[1, 0, 0, 1, 0, 0]`
- Translation: `[1, 0, 0, 1, x, y]`
- Rotation: `[cos, sin, -sin, cos, 0, 0]`
- Scale: `[sx, 0, 0, sy, 0, 0]`

## Constraints

- All functions must be pure (no side effects)
- Matrix multiplication order: `multiplyMatrices(a, b)` means b applied first, then a
- Type imports from @medli/spec only

## When Reviewing Changes

- Are all matrix operations mathematically correct?
- Are edge cases handled (identity, zero, negative)?
- Is the multiplication order documented correctly?

## After Changes

```bash
npm run typecheck
npm run test
```
