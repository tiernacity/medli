# renderer-svg Agent Instructions

## Your Role

You maintain the **SVG DOM renderer** - transforms Frame spec into SVG elements.

**Your job is to:**
- Call `validateFrame()` before rendering (fail fast on invalid frames)
- Traverse the Material tree depth-first
- Resolve styles using `resolveMaterial(ancestors)`
- Create/update SVG elements with correct attributes

**Correctness is non-negotiable.** Visual output must match the Canvas renderer exactly.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | SvgRenderer class extending BaseRenderer |

## Rendering Contract

```
1. validateFrame(frame) → fail fast if invalid
2. Traverse frame.root depth-first
3. Track ancestor Materials in stack
4. For each Shape: resolveMaterial(ancestors) → get fill/stroke/strokeWidth
5. Create/update SVG element with resolved styles
```

## SVG-Specific Considerations

- **Namespace required**: `document.createElementNS("http://www.w3.org/2000/svg", ...)`
- **Attribute names**: `fill`, `stroke`, `stroke-width` (hyphenated)
- **Background**: `<rect>` element covering viewport
- **Shapes**: `<circle>`, `<line>`, etc.

## Constraints

- **Validate first** - never render invalid frames
- **Traverse full tree** - handle arbitrary nesting depth
- **Resolve styles per shape** - don't assume flat structure
- **Visual parity** - must match Canvas renderer output

## When Reviewing Changes

- Is validateFrame() called before rendering?
- Does tree traversal handle nested ChildMaterials?
- Are ancestors tracked correctly for resolveMaterial()?
- Do SVG attributes use correct namespace and naming?

## When Adding Shape Support

1. Add case to shape rendering switch/if
2. Create appropriate SVG element (`<circle>`, `<line>`, `<rect>`, etc.)
3. Apply resolved material styles
4. Verify visual parity with Canvas renderer

## After Changes

```bash
npm run test                    # Unit tests pass
npm run typecheck               # Types correct
cd packages/test-app && npm run dev   # Visual verification
```
