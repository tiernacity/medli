# WebGPU Renderer Design

## Overview

The WebGPU renderer transforms Frame spec IR into WebGPU render commands, producing visually equivalent output to Canvas, SVG, and WebGL renderers.

## Technology Stack

### Dependencies

| Package | Purpose | Rationale |
|---------|---------|-----------|
| typegpu | Type-safe WebGPU wrapper | TypeScript-first, declarative API, excellent DX |
| gl-matrix | Matrix math | Consistent with WebGL renderer, high-performance |
| @webgpu/types | WebGPU TypeScript types | Required for type checking |

### Why TypeGPU?

[TypeGPU](https://docs.swmansion.com/TypeGPU/) by Software Mansion was chosen for several reasons:

**Type Safety:**
- TypeScript types mirror WGSL types exactly
- Compile-time validation of buffer layouts
- Automatic byte alignment and padding

**API Design:**
```typescript
// Define a struct in TypeScript that matches WGSL
const Particle = d.struct({
  position: d.vec2f,
  velocity: d.vec2f,
});

// Create buffer with automatic type inference
const buffer = root.createBuffer(d.arrayOf(Particle, 100), initialData);
```

**Escape Hatch:**
- Granular ejection to vanilla WebGPU at any point
- No lock-in: access raw `GPUDevice`, `GPUBuffer`, etc. when needed
- Can interoperate with other WebGPU libraries

**Learning Path:**
- TypeGPU mirrors WGSL syntax, so learning TypeGPU teaches WebGPU
- Lower friction for contributors new to GPU programming

### Alternatives Considered

| Library | Verdict | Reason |
|---------|---------|--------|
| Raw WebGPU | Too verbose | TypeGPU reduces boilerplate significantly |
| wgpu (Rust) | Wrong language | We need TypeScript |
| luma.gl | Heavier abstraction | TypeGPU is more focused |
| PixiJS WebGPU | Full framework | We need a renderer, not a scene graph |

## Rendering Approach

### Shape Rendering Strategy: SDF

Same as WebGL, we use **Signed Distance Functions**:

```wgsl
// Circle SDF in WGSL
fn sd_circle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

// Rectangle SDF in WGSL - use Chebyshev distance for sharp corners
// > Lesson from WebGL: The standard box SDF produces slightly rounded corners.
// > Use max(d.x, d.y) (Chebyshev/L∞ distance) for pixel-perfect sharp corners
// > matching Canvas/SVG rendering.
fn sd_box(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p) - b;
    return max(d.x, d.y);  // Chebyshev distance for sharp corners
}

// Line SDF - use box SDF for square/butt caps
// > Lesson from WebGL: Capsule SDF (rounded ends) doesn't match Canvas/SVG
// > line rendering which uses square/butt caps. Use oriented box SDF instead.
fn sd_line(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, width: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    let d = pa - ba * h;
    // Use box distance (max of components) for square ends
    return max(abs(d.x), abs(d.y)) - width * 0.5;
}

// Anti-aliased edge
let aa = fwidth(d);
let alpha = 1.0 - smoothstep(-aa, aa, d);
```

> **Visual Parity Note:** SDF choices directly affect whether output matches Canvas/SVG. Test each primitive against all renderers in the test-app to verify parity.

### Instancing Strategy

WebGPU instancing is first-class:

```typescript
// Instance layout with TypeGPU
const InstanceStruct = d.struct({
  transform: d.mat3x3f,
  fillColor: d.vec4f,
  strokeColor: d.vec4f,
  strokeWidth: d.f32,
});

const instanceLayout = tgpu.vertexLayout(
  d.arrayOf(InstanceStruct),
  'instance'  // stepMode
);
```

### Pipeline State

WebGPU pipelines are **immutable** once created. Strategy:

```
Pre-create pipelines for each primitive type:
- circlePipeline
- rectanglePipeline
- linePipeline
- imagePipeline

Each pipeline has:
- Vertex shader
- Fragment shader
- Vertex layout (quad geometry)
- Instance layout (transform + material)
- Blend state (for transparency)
- Depth state (for draw order)
```

## Pipeline Architecture

### Per-Frame Flow

```
1. Generator.frame(context) → Frame IR
2. validateFrame(frame)
3. Build instance data:
   - Traverse Frame tree
   - Group shapes by type
   - Compute world transforms
   - Resolve materials
4. Upload instance buffers (writeBuffer)
5. Begin render pass:
   - Clear if frame.background
   - For each primitive type:
     - Set pipeline
     - Set bind group (uniforms)
     - Set vertex/instance buffers
     - draw(6, instanceCount)  // 6 vertices per quad
```

### TypeGPU Pipeline Creation

```typescript
const circlePipeline = root['~unstable']
  .withVertex(circleVertex, {
    position: vertexLayout.attrib,
    transform: instanceLayout.attrib.transform,
    fillColor: instanceLayout.attrib.fillColor,
    strokeColor: instanceLayout.attrib.strokeColor,
    strokeWidth: instanceLayout.attrib.strokeWidth,
  })
  .withFragment(circleFragment, { format: 'rgba8unorm' })
  .createPipeline({
    primitive: { topology: 'triangle-strip' },
  });
```

### Shader Functions with TypeGPU

```typescript
const circleVertex = tgpu['~unstable'].vertexFn({
  in: {
    position: d.vec2f,
    transform: d.mat3x3f,
    fillColor: d.vec4f,
    // ...
  },
  out: {
    outPos: d.builtin.position,
    localPos: d.vec2f,
    vFillColor: d.vec4f,
    // ...
  },
}) /* wgsl */`{
  let worldPos = in.transform * vec3f(in.position, 1.0);
  let clipPos = uniforms.viewportTransform * worldPos;
  return Out(vec4f(clipPos.xy, 0.0, 1.0), in.position, in.fillColor, ...);
}`;
```

## Bind Groups and Uniforms

### Bind Group Organization

```
Bind Group 0 (Global - updated once per frame):
  - viewportTransform: mat3x3f
  - time: f32
  - resolution: vec2f

Bind Group 1 (Per-primitive-type):
  - (none currently, reserved for textures)
```

### Buffer Updates

Use `writeBuffer()` for dynamic data:

```typescript
// Update instance buffer each frame
device.queue.writeBuffer(instanceBuffer, 0, instanceData);
```

For static geometry (unit quad), use `mappedAtCreation`:

```typescript
const quadBuffer = device.createBuffer({
  size: quadData.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Float32Array(quadBuffer.getMappedRange()).set(quadData);
quadBuffer.unmap();
```

## Transform Handling

### Matrix Format

Frame spec: 6-value 2D affine `[a, b, c, d, e, f]`

For WebGPU, expand to `mat3x3f` (column-major):
```wgsl
// In WGSL, mat3x3f is column-major
// [a, b, c, d, e, f] becomes:
// | a  c  e |
// | b  d  f |
// | 0  0  1 |
```

### Transform Accumulation

Same as WebGL - accumulate during tree traversal using gl-matrix.

### Viewport Transform

```typescript
// Frame viewport → WebGPU clip space (-1 to 1)
function computeViewportMatrix(viewport: Viewport): Float32Array {
  const mat = mat3.create();
  mat3.scale(mat, mat, [
    1 / viewport.halfWidth,
    -1 / viewport.halfHeight  // Y-flip
  ]);
  return new Float32Array(mat);
}
```

## Resource Management

### Device Initialization

```typescript
const root = await tgpu.init();
// TypeGPU handles adapter/device acquisition

// Configure for canvas
const canvasContext = canvas.getContext('webgpu');
canvasContext.configure({
  device: root.device,
  format: navigator.gpu.getPreferredCanvasFormat(),
});
```

### Texture Handling

```typescript
const resourceManager = new ResourceManager({
  process: async (blob: Blob) => {
    const imageBitmap = await createImageBitmap(blob);

    const texture = root['~unstable'].createTexture({
      size: [imageBitmap.width, imageBitmap.height],
      format: 'rgba8unorm',
    }).$usage('sampled');

    texture.write(imageBitmap);
    return texture;
  },
  dispose: (texture) => {
    texture.destroy();
  },
});
```

### Buffer Lifecycle

WebGPU buffers are **immutable in size/usage**. Strategy:
- Create instance buffers with generous initial capacity
- Track actual usage count
- Recreate larger buffers when needed
- Pool and reuse destroyed buffers

## Draw Order and Transparency

> **Lesson from WebGL:** Z-buffer/depth testing is **problematic** with SDF-based transparent shapes. SDF anti-aliased edges produce fragments with varying alpha (0.0 to 1.0) - these are intrinsically transparent. Depth test + alpha blending creates a fundamental conflict: the depth buffer doesn't understand transparency.

### Recommended Approach: Tree-Order Rendering (No Depth Buffer)

Based on WebGL implementation experience, the correct approach for 2D SDF rendering is:

1. **No depth buffer** - disable depth testing entirely
2. **Render in Frame tree traversal order** - painter's algorithm
3. **Smart consecutive batching** - batch shapes of the same type that appear consecutively in traversal order

This matches Canvas and SVG behavior exactly, which is critical for visual parity.

```typescript
// Pipeline configuration - NO depth buffer
{
  // No depthStencil configuration needed
  primitive: { topology: 'triangle-strip' },
}
```

### Why Not Z-Buffer?

The original design proposed z-buffer with two-pass rendering. WebGL implementation revealed why this fails:

| Approach | Problem |
|----------|---------|
| Pure depth testing | SDF AA edges have fragments with alpha 0.0-1.0. Depth test passes/fails entire fragment, causing hard edges or missing pixels |
| Depth test + depthMask(false) for transparent | Requires back-to-front sorting AND knowing which shapes are transparent. Every SDF shape has transparent edge pixels |
| Two-pass (opaque then transparent) | All SDF shapes have transparent edge fragments - there are no truly "opaque" shapes |

### Transparency and Alpha Blending

> **Lesson from WebGL:** Shaders must premultiply RGB by the color's own alpha BEFORE applying SDF alpha. Otherwise causes double-premultiplication and washed-out colors.

Correct alpha handling in fragment shader:
```wgsl
// Premultiply RGB by color alpha FIRST
let premultiplied = vec4f(color.rgb * color.a, color.a);

// THEN apply SDF alpha for anti-aliasing
let sdfAlpha = 1.0 - smoothstep(-aa, aa, d);
return vec4f(premultiplied.rgb * sdfAlpha, premultiplied.a * sdfAlpha);
```

Blend state for premultiplied alpha:
```typescript
{
  color: {
    srcFactor: 'one',  // NOT 'src-alpha' - already premultiplied
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
}

## WebGPU-Specific Considerations

### Browser Support

WebGPU is available in:
- Chrome 113+ (April 2023)
- Edge 113+
- Firefox (behind flag, nearing stable)
- Safari 18+ (September 2024)

**Fallback strategy**: Detect WebGPU, fall back to WebGL if unavailable.

### Error Handling

WebGPU has excellent error reporting:

```typescript
device.pushErrorScope('validation');
// ... operations ...
const error = await device.popErrorScope();
if (error) {
  console.error('WebGPU validation error:', error.message);
}
```

### Memory Management

- Explicitly destroy resources when no longer needed
- WebGPU doesn't have garbage collection for GPU resources
- Track all created buffers/textures for cleanup in `destroy()`

## Implementation Plan

### Phase 1: Foundation
1. WebGPURenderer class extending BaseRenderer
2. TypeGPU initialization (`tgpu.init()`)
3. Canvas context configuration
4. Viewport transform setup
5. Background clearing

### Phase 2: Primitives
1. Rectangle rendering (SDF shader)
2. Circle rendering (SDF shader)
3. Line rendering
4. Per-shape material resolution

### Phase 3: Transforms
1. Transform tree traversal
2. World transform accumulation
3. Instance buffer with transforms

### Phase 4: Performance
1. Instanced rendering
2. Batching by primitive type
3. Tree-order rendering with smart consecutive batching (no depth buffer - see "Draw Order" section)

### Phase 5: Images
1. Texture loading via ResourceManager
2. Image primitive rendering
3. Cropping via texture coordinates

> **Lesson from WebGL:** Image Y-coordinate handling requires care. WebGPU (like WebGL) has Y-axis pointing up, but Frame spec uses top-left origin (Y down). For images, subtract height from position.y when computing texture coordinates to match Canvas/SVG positioning.

### Phase 6: Polish
1. toViewportCoords() for interaction
2. Resize handling
3. Feature detection and fallback
4. Error handling

## File Structure

```
src/
├── index.ts           # WebGPURenderer class, exports
├── shaders/
│   ├── common.ts      # Shared WGSL functions (SDF, transforms)
│   ├── circle.ts      # Circle vertex/fragment shaders
│   ├── rect.ts        # Rectangle vertex/fragment shaders
│   ├── line.ts        # Line vertex/fragment shaders
│   └── image.ts       # Image vertex/fragment shaders
├── pipelines.ts       # Pipeline creation and caching
├── buffers.ts         # Instance buffer management
└── types.ts           # TypeGPU struct definitions
```

## Color Parsing Performance

> **Critical Lesson from WebGL:** CSS color parsing was the #1 performance bottleneck, consuming 99%+ of frame time in stress tests (200 shapes: 184ms for color parsing vs 0.14ms for GPU rendering).

### The Problem

Parsing CSS color strings (hex, rgb(), rgba(), named colors) to normalized RGBA values requires canvas 2D context:

```typescript
// SLOW: Creates canvas per call, no caching
function parseColor(color: string): [number, number, number, number] {
  const canvas = document.createElement('canvas');  // Allocation
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;  // Expensive readback
  return [data[0]/255, data[1]/255, data[2]/255, data[3]/255];
}
```

### The Solution

**Memoize + Reuse Canvas:**
```typescript
import { memoize } from 'es-toolkit';

let colorCtx: CanvasRenderingContext2D | null = null;
function getColorContext() {
  if (!colorCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    colorCtx = canvas.getContext('2d');
  }
  return colorCtx;
}

function parseColorImpl(color: string): [number, number, number, number] {
  const ctx = getColorContext();
  ctx.clearRect(0, 0, 1, 1);  // CRITICAL: Clear before each parse!
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0]/255, data[1]/255, data[2]/255, data[3]/255];
}

const parseColor = memoize(parseColorImpl);  // Cache results
```

**Results:** 900x+ speedup (200 shapes: 184ms → 0.2ms)

> **Warning:** The `clearRect()` call is essential. Without it, semi-transparent colors blend with previously parsed colors on the reused canvas, producing incorrect RGBA values.

## Known Limitations

### Transparency and Draw Order

The design renders shapes in Frame tree traversal order (painter's algorithm), matching Canvas and SVG behavior. This is intentional based on WebGL implementation experience - see "Draw Order and Transparency" section for rationale.

For complex overlapping transparent scenes:
- Draw order is determined by position in the Frame tree (same as Canvas/SVG)
- This is correct behavior for visual parity
- Order-independent transparency (OIT) is a future consideration for advanced use cases

### Future Features

The following features are not supported and would require significant architectural work:

| Feature | Complexity | Notes |
|---------|------------|-------|
| Gradients | High | Per-instance gradient data, shader changes |
| Patterns | High | Texture sampling infrastructure |
| Filters (blur, shadow) | Very High | Multi-pass rendering |
| Text | Very High | SDF font atlas, glyph caching |
| Blend modes | Medium | Per-shape pipeline blend state |
| Compute shaders | Medium | TypeGPU supports, not yet designed |

These are recorded as design concerns for future iterations.

---

## Device Loss Handling

WebGPU devices can be lost, similar to WebGL context loss.

### Causes
- GPU memory pressure
- GPU process crash (browser limits: 3 crashes in 2 min blocks all pages)
- `device.destroy()` called explicitly
- Adapter unavailable (GPU unplugged/disabled)
- Long operations causing GPU reset

### Required Implementation

```typescript
// After device acquisition
device.lost.then((info) => {
  console.error(`WebGPU device lost: ${info.message}`);
  this.device = null;

  if (info.reason !== 'destroyed') {
    // Transient loss - try to recover
    this.reinitialize();
  }
});

// Reinitialize requires new adapter AND device
async reinitialize() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter unavailable');
  }
  this.device = await adapter.requestDevice();
  this.recreateResources();
}
```

### Resource Recreation

All GPU resources must be recreated with new device:
- Render pipelines (recreate from shader modules)
- Buffers (recreate with same layout)
- Textures (refetch and recreate via ResourceManager)
- Bind groups (recreate with new buffer/texture references)

**Key difference from WebGL:** Device loss requires a completely new adapter and device, not just resource recreation on the same context.

---

## Buffer Management Strategy

### Instance Buffers

WebGPU buffers are immutable in size. Growth requires creating a new buffer.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial capacity | 256 instances | Handles typical scenes |
| Growth factor | 2x | Amortized allocation cost |
| Growth trigger | count > capacity | Grow before overflow |
| Shrink policy | Never | Avoids thrashing |

```typescript
function ensureCapacity(
  device: GPUDevice,
  buffer: GPUBuffer,
  capacity: number,
  required: number,
  bytesPerInstance: number
): { buffer: GPUBuffer; capacity: number } {
  if (required <= capacity) return { buffer, capacity };

  const newCapacity = Math.max(capacity * 2, required);

  // Destroy old buffer
  buffer.destroy();

  // Create new buffer
  const newBuffer = device.createBuffer({
    size: newCapacity * bytesPerInstance,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  return { buffer: newBuffer, capacity: newCapacity };
}
```

### Static Buffers

Quad geometry buffer is created once with `mappedAtCreation: true` and reused for all frames.

---

## TypeGPU Learning Resources

- [TypeGPU Documentation](https://docs.swmansion.com/TypeGPU/)
- [TypeGPU GitHub](https://github.com/software-mansion/TypeGPU)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
- [Your First WebGPU App (Google Codelab)](https://codelabs.developers.google.com/your-first-webgpu-app)

## References

- [TypeGPU by Software Mansion](https://docs.swmansion.com/TypeGPU/)
- [WebGPU Explainer](https://gpuweb.github.io/gpuweb/explainer/)
- [WebGPU Buffer Uploads](https://toji.dev/webgpu-best-practices/buffer-uploads.html)
- [WebGPU Bind Groups](https://toji.dev/webgpu-best-practices/bind-groups.html)
- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
