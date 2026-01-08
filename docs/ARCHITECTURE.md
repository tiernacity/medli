# Medli Architecture

## Overview

Medli separates concerns into three layers:

| Layer | Role | Packages |
|-------|------|----------|
| Generators | Transform ergonomic API → Frame IR | generator-procedural, generator-object |
| Frame Spec | Intermediate representation (IR) | spec |
| Renderers | Consume Frame IR → visual output | renderer-svg, renderer-canvas |

## Processing Pipeline

```
Client Code
    ↓
Generator (emits valid Frame IR quickly)
    ↓
[Optimizer] (optional: compact transforms, dedupe materials) ← FUTURE
    ↓
Renderer (validates → pre-processes → renders)
    ↓
Visual Output
```

**Design principle:** Generators prioritize speed and simplicity. Optimization is a separate, optional pass. Renderers handle validation and any pre-processing (e.g., extracting materials, computing world transforms).

## The API vs IR Distinction

**CRITICAL: Generator APIs do NOT mirror Frame IR structure.**

| Generator | User-Facing API | Internal Transformation |
|-----------|-----------------|------------------------|
| Procedural | Imperative calls in sequence | Builds nested Material tree |
| Object | Scene graph with transforms + material refs | Groups by material into tree |

Both produce **identical Frame IR** from **different API paradigms**.

Generators are opinionated about ergonomics. The IR is opinionated about validation simplicity.

### Object Generator Class Hierarchy

Inspired by three.js Object3D pattern:

```
SceneObject (base - position, rotation, scale)
├── Group (children only, NO material)
├── Circle (geometry + material ref)
├── Line (geometry + material ref)
└── ... other shapes

Material (independent object, NOT a SceneObject)
Scene (root container, IS the Generator)
```

**Key design decisions:**
- SceneObject provides transforms (like three.js Object3D)
- Shapes have `.material` property (like three.js Mesh)
- Groups have NO `.material` - purely organizational
- Shapes without material use Scene's default styles
- Transform inheritance via scene graph; material via explicit references

## Frame Spec IR

The Frame is a tree of Materials, Transforms, and Shapes:

```
Frame
└── root: RootMaterial (complete: fill, stroke, strokeWidth required)
    └── children: FrameNode[]
        ├── ChildMaterial (partial overrides, ref to ancestor ID)
        │   └── children: FrameNode[]
        ├── Transform (6-value 2D affine matrix)
        │   └── children: FrameNode[]
        └── Shape (pure geometry, no style properties)
```

### Materials vs Transforms

| Concern | Materials | Transforms |
|---------|-----------|------------|
| Behavior | **Inherit** with overrides | **Accumulate** via multiplication |
| ID | Required (for ref) | None needed |
| Root | Must be complete | N/A (optional) |
| Nesting | Can nest arbitrarily | Can nest arbitrarily |

**Materials and Transforms nest flexibly.** Renderers separate these concerns during traversal.

### Transform Representation

Transforms use a 6-value 2D affine matrix `[a, b, c, d, e, f]`:

```
| a  c  e |
| b  d  f |     Point (x,y) → (ax + cy + e, bx + dy + f)
| 0  0  1 |
```

- Identity: `[1, 0, 0, 1, 0, 0]` (but prefer omitting the Transform node)
- Composition: `worldMatrix = parentMatrix × localMatrix`

Generator APIs provide ergonomic `translate()`, `rotate()`, `scale()` that compose into matrices.

**Design rationale:**
- Single-pass validation (top-down, no cycles possible)
- Style inheritance via tree structure
- Transform accumulation via matrix multiplication
- Shapes are leaves with no style - they inherit from ancestor Materials

**Validation rules:**
1. Root has all style properties defined
2. Material IDs unique across tree
3. ChildMaterial.ref must point to an ancestor
4. Transform.matrix must have exactly 6 numbers
5. Shapes cannot have children (type-enforced)

## Component Contracts

### Generators
- **Own the user-facing API** - be opinionated, match inspiration library
- **Emit valid Frame IR** - correctness is non-negotiable
- **Do not validate own output** - separation of concerns

### Renderers
- **Call validateFrame() first** - single point of validation
- **Traverse tree depth-first** - track ancestor stack
- **Call resolveMaterial(ancestors)** - get effective style per shape
- **Map shapes to render target** - SVG elements or Canvas calls

### Spec
- **Types only** - Frame, Material, Shape definitions
- **Validation utilities** - validateFrame(), resolveMaterial()
- **No rendering logic** - pure data structures

## Parity Requirements

| Requirement | Meaning |
|-------------|---------|
| Generator parity | Both generators support identical primitives |
| Renderer parity | All renderers produce visually equivalent output |
| Verification | test-app displays all combinations for Playwright comparison |

## Adding New Primitives

1. Add Shape type to `spec`
2. Add to procedural generator (sketch method)
3. Add to object generator (Shape class)
4. Add rendering to both renderers
5. Update test-app to exercise the primitive
6. Verify visual parity across all 4 combinations

## Future: Optimizer Pass

A post-generation optimizer can compact Frame IR without changing semantics:

| Optimization | Description |
|--------------|-------------|
| Transform merging | Sequentially-nested transforms → single matrix |
| Material deduplication | Identical materials → shared reference |
| Identity elimination | Remove identity transforms |

**Safety:** Matrix multiplication is associative, so merging nested transforms is always safe.

**Not implemented yet.** Generators emit valid IR quickly; optimization is deferred.
