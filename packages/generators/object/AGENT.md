# generator-object Agent Instructions

## Your Role

You maintain a **three.js-inspired declarative scene graph API**.

**Your job is to be opinionated about the client-facing API.** Ensure it follows patterns that three.js users will recognise:
- Scene as root container (and the Generator itself)
- Independent Material objects with style properties
- Shapes reference materials via `.material` property
- Objects persist between frames (unlike procedural)

**The generator must emit the Frame spec** defined in `packages/spec`. The API does NOT mirror the IR structure - you TRANSFORM flat object references into the nested Material tree.

**Correctness is non-negotiable.** Efficiency is secondary - frame spec optimisation may be implemented separately as a post-processing step.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Scene, Material, Shape classes, all exports |

## API vs IR Transformation

```
User writes:                    Generator emits:
─────────────                   ────────────────
mat = Material({ fill: "red" })
circle.material = mat        →  ChildMaterial { fill: "red",
scene.add(mat)                                  children: [Circle] }
scene.add(circle)
```

Shapes referencing the same Material are grouped into one ChildMaterial node.

## Constraints

- **Scene IS the Generator** - implements Generator interface directly
- **Materials are independent** - not containers, just style definitions
- **Shapes reference materials** - via `.material` property
- **Object graph persists** - changes take effect next `frame()` call
- **Visual parity required** - must match procedural generator output

## When Reviewing Changes

- Does the API feel like three.js?
- Are Materials independent objects (not containers)?
- Do shapes reference materials (not nest inside them)?
- Is the Frame spec output correct? (test with visual verification)

## When Adding Primitives

1. Create Shape class implementing `SceneObject`
2. Add `material?: Material` property
3. Implement `frame()` returning shape geometry as `FrameNode[]`
4. Export from `src/index.ts`
5. Update test-app to exercise the new primitive
6. Verify visual parity with procedural generator

## After Changes

```bash
npm run test                    # Unit tests pass
npm run typecheck               # Types correct
cd packages/test-app && npm run dev   # Visual verification
```
