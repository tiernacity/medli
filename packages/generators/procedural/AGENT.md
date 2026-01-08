# generator-procedural Agent Instructions

## Your Role

You maintain a **p5.js-inspired imperative sketch API**.

**Your job is to be opinionated about the client-facing API.** Ensure it follows patterns that p5.js users will recognise:
- Imperative function calls: `fill()`, `stroke()`, `circle()`, `line()`
- State management: `push()`, `pop()` for style isolation
- Draw function called every frame with fresh context

**The generator must emit the Frame spec** defined in `packages/spec`. The API does NOT mirror the IR structure - you TRANSFORM imperative calls into the nested Material tree.

**Correctness is non-negotiable.** Efficiency is secondary - frame spec optimisation may be implemented separately as a post-processing step.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Sketch interface, ProceduralGenerator class |

## API vs IR Transformation

```
User writes:          Generator emits:
─────────────         ────────────────
fill("red")
circle(10, 10, 5)  →  ChildMaterial { fill: "red", children: [Circle] }
fill("blue")
circle(20, 20, 5)  →  ChildMaterial { fill: "blue", children: [Circle] }
```

## Constraints

- **State resets each frame** - no accumulation between frames
- **Sketch parameter, not globals** - `p.fill()` not `fill()`
- **push/pop creates nesting** - maps to Material tree depth
- **Visual parity required** - must match object generator output

## When Reviewing Changes

- Does the API feel like p5.js?
- Is the Frame spec output correct? (test with visual verification)
- Are style changes creating appropriate ChildMaterial nodes?
- Does push/pop correctly manage the Material tree?

## When Adding Primitives

1. Add method to `Sketch` interface
2. Implement in sketch context object inside `frame()`
3. Create appropriate shape in `shapes` array
4. Update test-app to exercise the new primitive
5. Verify visual parity with object generator

## After Changes

```bash
npm run test                    # Unit tests pass
npm run typecheck               # Types correct
cd packages/test-app && npm run dev   # Visual verification
```
