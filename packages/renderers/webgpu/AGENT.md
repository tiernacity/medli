# renderer-webgpu Agent Instructions

## Your Role

You maintain the **WebGPU renderer** - transforms Frame spec into WebGPU render commands using TypeGPU.

**Your job is to:**
- Call `validateFrame()` before rendering (fail fast on invalid frames)
- Traverse the Material tree depth-first, accumulating transforms
- Resolve styles using `resolveMaterial(ancestors)`
- Batch shapes by type and issue instanced draw calls

**Correctness is non-negotiable.** Visual output must match Canvas, SVG, and WebGL renderers exactly.

## Key Files

| File | Purpose |
|------|---------|
| `DESIGN.md` | Complete design documentation |
| `src/index.ts` | WebGPURenderer class extending BaseRenderer |
| `src/shaders/` | WGSL shaders via TypeGPU |
| `src/pipelines.ts` | Render pipeline creation |
| `src/buffers.ts` | Instance buffer management |
| `src/types.ts` | TypeGPU struct definitions |

## Technology Stack

| Package | Purpose |
|---------|---------|
| typegpu | Type-safe WebGPU wrapper |
| gl-matrix | Matrix math (transforms) |
| @webgpu/types | TypeScript types |

## TypeGPU Patterns

**Struct definitions:**
```typescript
const InstanceStruct = d.struct({
  transform: d.mat3x3f,
  fillColor: d.vec4f,
  strokeColor: d.vec4f,
  strokeWidth: d.f32,
});
```

**Buffer creation:**
```typescript
const buffer = root.createBuffer(d.arrayOf(InstanceStruct, 100), data)
  .$usage('storage');
```

**Shader functions:**
```typescript
const mainVertex = tgpu['~unstable'].vertexFn({
  in: { ... },
  out: { ... },
}) /* wgsl */`{ ... }`;
```

## Rendering Approach

**SDF-based primitives:**
- Circles, rectangles rendered as quads with SDF fragment shaders
- Anti-aliasing via `fwidth()` / `smoothstep()`
- Resolution-independent rendering

**Instanced rendering:**
- Group shapes by primitive type
- Single draw call per type
- Per-instance: transform, fill, stroke, strokeWidth

## Rendering Contract

```
1. validateFrame(frame) → fail fast if invalid
2. Build instance data for each primitive type
3. For each shape during traversal:
   - Accumulate transform matrices
   - Resolve material from ancestors
   - Add to appropriate instance buffer
4. Begin render pass
5. For each primitive type:
   - Set pipeline
   - Set bind groups
   - Set vertex/instance buffers
   - draw(6, instanceCount)
```

## WebGPU-Specific Considerations

- **Immutable pipelines**: Create pipelines once, reuse
- **Immutable buffers**: Size/usage fixed at creation
- **Explicit resource management**: Destroy buffers/textures manually
- **Y-flip**: Apply in viewport transform
- **Async initialization**: `tgpu.init()` is async

## Constraints

- **Validate first** - never render invalid frames
- **Accumulate transforms** - multiply matrices during traversal
- **Batch by type** - one draw call per primitive type
- **Resource cleanup** - destroy all GPU resources in `destroy()`
- **Visual parity** - must match Canvas/SVG/WebGL output exactly

## When Adding Shape Support

1. Create TypeGPU vertex/fragment functions with WGSL
2. Create pipeline with appropriate layouts
3. Define instance struct for new shape
4. Handle shape in traversal
5. Verify visual parity with other renderers

## After Changes

```bash
npm run typecheck               # Types correct (includes @webgpu/types)
npm run test                    # Unit tests pass
cd packages/test-app && npm run dev   # Visual verification
```

## Key Design Decisions

See `DESIGN.md` for complete rationale on:
- Why TypeGPU over alternatives
- SDF vs geometry-based primitives
- Instancing strategy
- Pipeline and bind group organization
- Buffer lifecycle management
