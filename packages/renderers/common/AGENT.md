# renderer-common Agent Instructions

## Your Role

You maintain **shared renderer functionality** - code that is identical across all renderers.

**Your job is to:**
- Provide animation loop management (loop/stop)
- Handle requestAnimationFrame lifecycle
- Keep this package minimal - only truly shared code

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | BaseRenderer class with loop/stop |

## What Belongs Here

- Animation loop (`loop()`, `stop()`)
- requestAnimationFrame management
- Any behavior identical across ALL renderers

## What Does NOT Belong Here

- DOM element handling (renderers differ: SVG vs Canvas)
- Actual rendering logic
- Frame validation (done in each renderer)
- Platform-specific code

## Constraints

- **Browser environment** - uses requestAnimationFrame
- **No DOM dependencies** - element handling is renderer-specific
- **Abstract render()** - subclasses implement actual rendering

## When Reviewing Changes

- Is this truly shared across ALL renderers?
- Does it avoid DOM-specific code?
- Will it work with future render targets (WebGL, etc)?

## After Changes

```bash
npm run test        # All renderer tests still pass
npm run typecheck   # Types correct
```
