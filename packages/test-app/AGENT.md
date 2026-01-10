# test-app Agent Instructions

## Your Role

You maintain the **visual verification app** - confirms all generator/renderer combinations produce identical output.

**Your job is to:**
- Display generator/renderer combinations for visual comparison
- Exercise all primitives and material features
- Enable Playwright to screenshot and compare outputs
- Provide full-screen sketch demos

**Visual parity is the goal.** If procedural and object generators don't match, something is wrong.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Main page setup, 2x2 grid layout |
| `src/full-screen.ts` | Full-screen sketch selector and display |
| `src/harnesses/*.ts` | Renderer harness wiring (proc-svg, proc-canvas, obj-svg, obj-canvas) |
| `src/scenes/*.ts` | Scene definitions exercising features (materials, transforms, images, etc.) |
| `src/sketches/*.ts` | Full-screen sketch demos (trees, particle-plotter, remote-pendulum) |
| `scripts/*.ts` | Standalone scripts (e.g., generate-pendulum.ts for server-side Frame generation) |

## Constraints

- **Testing only** - no production features
- **Exercise all features** - every primitive, material property, nesting level
- **Both generators must match** - identical visual output in scenes
- **Keep examples realistic** - show patterns users would actually write

## Visual Verification Workflow

```bash
npm run dev                     # Start dev server
# Use Playwright MCP to navigate to http://localhost:5173
# Take screenshots
# Compare all 4 outputs - they should be identical
```

## When Adding Primitives

1. Add scene in `src/scenes/` exercising the primitive
2. Update scene index to include the new scene
3. Verify all 4 harness outputs match visually

## When Adding Sketches

1. Create sketch file in `src/sketches/`
2. Export from `src/sketches/index.ts`
3. Test via full-screen page dropdown

## After Changes

```bash
npm run dev                     # Visual check
npm run typecheck               # Types correct
# Use Playwright to screenshot and compare
```
