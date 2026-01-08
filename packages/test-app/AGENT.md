# test-app Agent Instructions

## Your Role

You maintain the **visual verification app** - confirms all generator/renderer combinations produce identical output.

**Your job is to:**
- Display all 4 combinations (2 generators x 2 renderers) side-by-side
- Exercise all primitives and material features
- Enable Playwright to screenshot and compare outputs
- Keep examples comprehensive but not production code

**Visual parity is the goal.** If procedural and object generators don't match, something is wrong.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | App setup, UI layout |
| `src/generators/procedural.ts` | Procedural generator example |
| `src/generators/object.ts` | Object generator example |
| `src/harnesses/*.ts` | Renderer harness code |

## Constraints

- **Testing only** - no production features
- **Exercise all features** - every primitive, material property, nesting level
- **Both generators must match** - identical visual output
- **Keep examples realistic** - show patterns users would actually write

## Visual Verification Workflow

```bash
npm run dev                     # Start dev server
# Use Playwright MCP to navigate to http://localhost:5173
# Take screenshots
# Compare all 4 outputs - they should be identical
```

## When Reviewing Changes

- Do both generator examples exercise the same features?
- Are all primitives represented?
- Are material features (fill, stroke, strokeWidth, nesting) tested?
- Would Playwright catch a regression?

## When Adding Primitives

1. Add to `src/generators/procedural.ts` using sketch API
2. Add to `src/generators/object.ts` using scene graph API
3. Position identically in both
4. Verify all 4 outputs match visually

## After Changes

```bash
npm run dev                     # Visual check
npm run typecheck               # Types correct
# Use Playwright to screenshot and compare
```
