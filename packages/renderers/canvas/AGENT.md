# renderer-canvas Agent Instructions

## Your Role

You maintain the **Canvas 2D renderer** - transforms Frame spec into Canvas draw calls.

**Your job is to:**
- Call `validateFrame()` before rendering (fail fast on invalid frames)
- Traverse the Material tree depth-first
- Resolve styles using `resolveMaterial(ancestors)`
- Issue Canvas 2D API calls with correct styles

**Correctness is non-negotiable.** Visual output must match the SVG renderer exactly.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CanvasRenderer class extending BaseRenderer |

## Rendering Contract

```
1. validateFrame(frame) → fail fast if invalid
2. Clear canvas / draw background
3. Traverse frame.root depth-first
4. Track ancestor Materials in stack
5. For each Shape: resolveMaterial(ancestors) → get fill/stroke/strokeWidth
6. Issue Canvas API calls with resolved styles
```

## Canvas-Specific Considerations

- **Immediate mode**: must redraw everything each frame
- **Context state**: `ctx.fillStyle`, `ctx.strokeStyle`, `ctx.lineWidth`
- **Path-based shapes**: `beginPath()`, then path commands, then `fill()`/`stroke()`
- **Background**: `fillRect()` covering viewport

## Constraints

- **Validate first** - never render invalid frames
- **Redraw everything** - Canvas doesn't retain state
- **Traverse full tree** - handle arbitrary nesting depth
- **Resolve styles per shape** - don't assume flat structure
- **Visual parity** - must match SVG renderer output

## When Reviewing Changes

- Is validateFrame() called before rendering?
- Does tree traversal handle nested ChildMaterials?
- Are ancestors tracked correctly for resolveMaterial()?
- Are Canvas API calls in correct order (beginPath, path, fill/stroke)?

## When Adding Shape Support

1. Add case to shape rendering switch/if
2. Issue appropriate Canvas API calls
3. Apply resolved material styles (fillStyle, strokeStyle, lineWidth)
4. Verify visual parity with SVG renderer

## After Changes

```bash
npm run test                    # Unit tests pass
npm run typecheck               # Types correct
cd packages/test-app && npm run dev   # Visual verification
```
