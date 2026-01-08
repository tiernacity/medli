# generator-object Agent Instructions

## Your Role

You maintain a **three.js-inspired declarative scene graph API**.

**Your job is to be opinionated about the client-facing API.** Ensure it follows patterns that three.js users will recognise:
- Scene as root container (and the Generator itself)
- SceneObject base class with transform properties (like three.js Object3D)
- Independent Material objects with style properties
- Shapes reference materials via `.material` property
- Objects persist between frames (unlike procedural)

**The generator must emit the Frame spec** defined in `packages/spec`. The API does NOT mirror the IR structure - you TRANSFORM flat object references into the nested Material tree.

**Correctness is non-negotiable.** Efficiency is secondary - frame spec optimisation may be implemented separately as a post-processing step.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | SceneObject, Scene, Material, Shape classes, all exports |

## Class Hierarchy (three.js-inspired)

```
SceneObject (base - has position, rotation, scale)
├── Group (container for children, NO material)
├── Circle (shape - has material reference)
├── Line (shape - has material reference)
└── ... other shapes

Material (independent - NOT a SceneObject)
Scene (root container, IS the Generator)
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SceneObject has transforms** | Like three.js Object3D - all objects can be positioned/rotated/scaled |
| **Shapes have `.material`** | Like three.js Mesh - shapes reference materials explicitly |
| **Groups have NO `.material`** | Like three.js Group - purely organizational, transforms only |
| **Shapes without material use Scene defaults** | Scene has fill/stroke/strokeWidth that become root Material |

### Transform vs Material

- **Transforms**: Inherited via scene graph (Group transforms apply to children)
- **Materials**: Explicit references (shape.material = mat), NOT inherited via scene graph
- **Material-to-Material inheritance**: Via `material.parent` property if needed

## API vs IR Transformation

```
User writes:                    Generator emits:
─────────────                   ────────────────
mat = Material({ fill: "red" })
circle.material = mat        →  ChildMaterial { fill: "red",
scene.add(circle)                               children: [Circle] }

// Shape with transform
circle.position = { x: 50, y: 50 }  →  Transform { matrix: [...],
                                                   children: [Circle] }
```

Shapes referencing the same Material are grouped into one ChildMaterial node.

## Constraints

- **Scene IS the Generator** - implements Generator interface directly
- **SceneObject is the base** - provides position, rotation, scale
- **Materials are independent** - not containers, just style definitions
- **Shapes reference materials** - via `.material` property (optional, defaults to Scene)
- **Groups have NO material** - purely for collective transforms
- **Object graph persists** - changes take effect next `frame()` call
- **Visual parity required** - must match procedural generator output

## When Reviewing Changes

- Does the API feel like three.js?
- Do all scene objects have transform properties?
- Are Materials independent objects (not containers)?
- Do shapes reference materials (not nest inside them)?
- Do Groups have transforms but NO material?
- Is the Frame spec output correct? (test with visual verification)

## When Adding Primitives

1. Create Shape class extending `SceneObject`
2. Shape inherits transforms from SceneObject
3. Add `material?: Material` property
4. Implement `frame()` returning shape geometry as `FrameNode[]`
5. Export from `src/index.ts`
6. Update test-app to exercise the new primitive
7. Verify visual parity with procedural generator

## After Changes

```bash
npm run test                    # Unit tests pass
npm run typecheck               # Types correct
cd packages/test-app && npm run dev   # Visual verification
```
