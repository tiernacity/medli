# Medli Architecture

## Overview

Medli separates concerns into three layers:

| Layer | Role | Packages |
|-------|------|----------|
| Generators | Transform ergonomic API → Frame IR | generator-procedural, generator-object |
| Frame Spec | Intermediate representation (IR) | spec |
| Renderers | Consume Frame IR → visual output | renderer-svg, renderer-canvas |

## The API vs IR Distinction

**CRITICAL: Generator APIs do NOT mirror Frame IR structure.**

| Generator | User-Facing API | Internal Transformation |
|-----------|-----------------|------------------------|
| Procedural | Imperative calls in sequence | Builds nested Material tree |
| Object | Flat object references | Groups by material into tree |

Both produce **identical Frame IR** from **different API paradigms**.

Generators are opinionated about ergonomics. The IR is opinionated about validation simplicity.

## Frame Spec IR

The Frame is a Material-based tree:

```
Frame
└── root: RootMaterial (complete: fill, stroke, strokeWidth required)
    └── children: FrameNode[]
        ├── ChildMaterial (partial overrides, ref to ancestor ID)
        │   └── children: FrameNode[]
        └── Shape (pure geometry, no style properties)
```

**Design rationale:**
- Single-pass validation (top-down, no cycles possible)
- Style inheritance via tree structure
- Shapes are leaves with no style - they inherit from ancestor Materials

**Validation rules:**
1. Root has all style properties defined
2. Material IDs unique across tree
3. ChildMaterial.ref must point to an ancestor
4. Shapes cannot have children (type-enforced)

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
