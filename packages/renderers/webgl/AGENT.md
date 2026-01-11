# renderer-webgl Agent Instructions

## Your Role

You maintain the **WebGL 2 renderer** - transforms Frame spec into WebGL draw calls using TWGL.js.

**Your job is to:**
- Call `validateFrame()` before rendering (fail fast on invalid frames)
- Traverse the Material tree depth-first, accumulating transforms
- Resolve styles using `resolveMaterial(ancestors)`
- Batch shapes by type and issue instanced draw calls

**Correctness is non-negotiable.** Visual output must match Canvas, SVG, and WebGPU renderers exactly.

## Key Files

| File | Purpose |
|------|---------|
| `DESIGN.md` | Complete design documentation |
| `src/index.ts` | WebGLRenderer class extending BaseRenderer |
| `src/shaders/` | GLSL vertex and fragment shaders |
| `src/pipeline.ts` | Shader program management |
| `src/geometry.ts` | Quad geometry, instance buffers |

## Technology Stack

| Package | Purpose |
|---------|---------|
| twgl.js | WebGL helper (buffer/texture/program creation) |
| gl-matrix | Matrix math (transforms) |

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
4. Set viewport transform uniform
5. For each primitive type:
   - Bind shader program
   - Upload instance buffer
   - drawArraysInstanced()
```

## WebGL-Specific Considerations

- **Stateful API**: WebGL has global state (current program, buffers, etc.)
- **Y-flip**: WebGL Y-up, Canvas/DOM Y-down - flip in viewport transform
- **TWGL helpers**: Use `twgl.createProgramInfo()`, `twgl.setUniforms()`, etc.
- **Buffer management**: Pre-allocate, reuse buffers across frames

## Constraints

- **Validate first** - never render invalid frames
- **Accumulate transforms** - multiply matrices during traversal
- **Batch by type** - one draw call per primitive type
- **Visual parity** - must match Canvas/SVG/WebGPU output exactly

## When Adding Shape Support

1. Create vertex shader (quad + transform)
2. Create fragment shader (SDF + color)
3. Add shader program to pipeline
4. Add instance struct for new shape
5. Handle shape in traversal
6. Verify visual parity with other renderers

## After Changes

```bash
npm run typecheck               # Types correct
npm run test                    # Unit tests pass
cd packages/test-app && npm run dev   # Visual verification
```

## Key Design Decisions

See `DESIGN.md` for complete rationale on:
- Why TWGL.js over alternatives
- SDF vs geometry-based primitives
- Instancing strategy
- Transform handling
