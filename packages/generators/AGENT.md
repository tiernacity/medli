# Generator Shared Concepts

## The Generator Contract

All generators implement the `Generator` interface from `@medli/spec`:

```typescript
interface Generator {
  frame(context: RenderContext): Frame;
}

type RenderContext = {
  time: number;
  targetDimensions: [number, number];
};
```

## Generator Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Creative** | Build Frame IR from scratch | `generator-procedural`, `generator-object` |
| **Fetch** | Obtain Frame from external source | `generator-remote` |
| **Pipeline** | Transform Frame from upstream generator | `generator-validator`, `generator-optimizer` |

## Pipeline Composition

Pipeline generators wrap an upstream generator and transform its output:

```typescript
const gen = new ProceduralGenerator(draw);
const validated = withValidation(gen);       // Throws if invalid
const optimized = withOptimization(validated); // Compacts IR
// Renderer uses 'optimized' as its generator
```

**Recommended pipeline order:**
1. Creative/Fetch generator (produces Frame)
2. Validator (fail fast on invalid frames)
3. Optimizer (compact IR for efficient rendering)

## Frame IR Design Principles

### API vs IR

Generators provide **ergonomic APIs** that transform to **Frame IR**:
- Procedural: p5.js-style imperative calls -> nested nodes
- Object: three.js-style scene graph -> nested nodes

The API does NOT mirror the IR structure.

### Materials Inherit, Transforms Accumulate

| Concern | Behavior | IR Pattern |
|---------|----------|------------|
| **Materials** | Child overrides parent properties | `ref` points to ancestor ID |
| **Transforms** | Multiply parent x child matrices | Nested Transform nodes |

### Naive vs Optimized IR

**Creative generators emit naive IR:**
- Each style call creates a nested ChildMaterial node
- Each transform call creates a nested Transform node
- No accumulation, no grouping, no optimization

**The optimizer handles compaction:**
- Merge sequential transforms via matrix multiplication
- Squash sequential materials where safe
- Remove identity transforms

This separation keeps generators simple and makes optimization reusable.

## Shared Utilities

`@medli/generator-utils` provides:
- Matrix operations: `translateMatrix`, `rotateMatrix`, `scaleMatrix`
- Matrix composition: `multiplyMatrices`
- Matrix checks: `isIdentityMatrix`, `matricesEqual`

Import from `@medli/generator-utils` rather than duplicating.

## Testing Guidelines

- Unit test Frame IR structure
- Visual verification via test-app for rendering correctness
- Optimized frames must render identically to unoptimized frames
