# WebGL Renderer Design

## Overview

The WebGL renderer transforms Frame spec IR into WebGL 2 draw calls, producing visually equivalent output to Canvas and SVG renderers.

## Technology Stack

### Dependencies

| Package | Purpose | Rationale |
|---------|---------|-----------|
| twgl.js | WebGL helper library | Reduces boilerplate without hiding WebGL. Thin wrapper, not a framework. |
| gl-matrix | Matrix math | High-performance, industry-standard for WebGL. |

### Why TWGL.js?

[TWGL](https://twgljs.org/) was chosen over alternatives:

- **vs. raw WebGL**: TWGL eliminates 50-80% of boilerplate while maintaining full WebGL access
- **vs. regl**: TWGL is lower-level, giving more control over state
- **vs. PixiJS**: We need a renderer, not a framework. TWGL is minimalist.

TWGL provides helpers for:
- Creating buffers, textures, and programs
- Setting uniforms from objects
- Resizing canvases correctly

It does NOT hide:
- Shader writing (we write our own GLSL)
- Draw call structure
- State management

### Why gl-matrix?

[gl-matrix](https://glmatrix.net/) is the de facto standard for WebGL matrix math:
- Zero dependencies
- Optimized for Float32Array (WebGL native format)
- Full 2D and 3D transform support

## Rendering Approach

### Shape Rendering Strategy: SDF vs Geometry

We use **Signed Distance Functions (SDFs)** for primitives:

| Shape | SDF Approach | Geometry Approach |
|-------|--------------|-------------------|
| Circle | 4 vertices (quad), SDF in fragment shader | N triangles for smooth curve |
| Rectangle | 4 vertices (quad), SDF in fragment shader | 4 vertices, 2 triangles |
| Line | 4 vertices (thick quad), distance function | 2 vertices, limited styling |

**SDF Benefits:**
- Resolution-independent (sharp at any zoom)
- Easy anti-aliasing with `fwidth()`
- Fewer vertices for complex shapes
- Uniform rendering pipeline

**SDF Trade-offs:**
- More fragment shader computation
- Fill-rate limited on complex scenes
- Requires understanding of distance functions

### SDF Implementations

```glsl
// Circle: distance from center minus radius
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Rectangle: box SDF
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Anti-aliased edge
float alpha = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
```

### Instancing Strategy

WebGL 2 native instancing is **critical** for performance:

```javascript
// Per-instance data (transforms, colors)
gl.vertexAttribDivisor(location, 1);
gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
```

**Batching by primitive type:**
- All circles in one draw call
- All rectangles in one draw call
- Minimizes pipeline/state switches

**Draw order handling:**
- Assign z-values based on Frame tree order
- Enable depth testing for correct layering
- Or: sort and draw back-to-front for transparency

## Pipeline Architecture

### Per-Frame Flow

```
1. Generator.frame(context) → Frame IR
2. validateFrame(frame)
3. Clear canvas (if frame.background)
4. Build/update instance buffers:
   - Traverse Frame tree
   - Group shapes by type
   - Compute world transforms (matrix accumulation)
   - Resolve materials per shape
5. Set viewport transform uniform
6. For each primitive type:
   - Bind pipeline (shader program)
   - Bind instance buffer
   - drawArraysInstanced()
```

### Shader Programs

Minimal set of programs:

| Program | Vertex Shader | Fragment Shader |
|---------|---------------|-----------------|
| circle | Quad + transform | Circle SDF + color |
| rectangle | Quad + transform | Rectangle SDF + color |
| line | Thick line quad | Line distance + color |
| image | Quad + transform | Texture sample |

### Uniforms Organization

```glsl
// Global (per-frame)
uniform mat3 u_viewportTransform;  // Frame coords → clip space
uniform float u_time;

// Per-instance (via attributes)
attribute mat3 a_transform;    // World transform
attribute vec4 a_fillColor;
attribute vec4 a_strokeColor;
attribute float a_strokeWidth;
```

## Transform Handling

### Matrix Format

Frame spec uses 6-value 2D affine: `[a, b, c, d, e, f]`

For WebGL, expand to 3x3 matrix (column-major):
```javascript
// [a, b, c, d, e, f] → mat3
const mat3 = [
  a, b, 0,    // column 0
  c, d, 0,    // column 1
  e, f, 1     // column 2
];
```

### Transform Accumulation

During tree traversal, accumulate transforms:
```javascript
function traverse(node, parentTransform) {
  if (node.type === 'transform') {
    const worldTransform = mat3.multiply(
      mat3.create(),
      parentTransform,
      expandMatrix(node.matrix)
    );
    for (const child of node.children) {
      traverse(child, worldTransform);
    }
  }
  // ...
}
```

### Viewport Transform

```javascript
// Frame viewport → WebGL clip space
// 1. Translate origin to center
// 2. Scale by viewport dimensions
// 3. Flip Y axis

const viewportTransform = mat3.create();
mat3.translate(viewportTransform, viewportTransform, [0, 0]);
mat3.scale(viewportTransform, viewportTransform, [
  1 / viewport.halfWidth,
  -1 / viewport.halfHeight  // Y-flip
]);
```

## Resource Management

### Texture Handling

Reuse the existing `ResourceManager` pattern from renderer-common:

```typescript
const resourceManager = new ResourceManager({
  process: async (blob: Blob) => {
    const imageBitmap = await createImageBitmap(blob);
    const texture = twgl.createTexture(gl, {
      src: imageBitmap,
      flipY: true,
    });
    return texture;
  },
  dispose: (texture: WebGLTexture) => {
    gl.deleteTexture(texture);
  },
});
```

### Buffer Pooling

For dynamic content, consider buffer pooling:
- Pre-allocate instance buffers for expected shape counts
- Grow buffers when needed, shrink lazily
- Reuse buffers across frames

### Image Cropping

Handle `Image.crop` via texture coordinates:
```glsl
// In vertex shader
vec2 texCoord = a_crop.xy + vertexUV * a_crop.zw;
```

## Anti-Aliasing

### SDF Anti-Aliasing

Use `fwidth()` for screen-space derivatives:
```glsl
float d = sdCircle(localPos, radius);
float aa = fwidth(d);
float alpha = 1.0 - smoothstep(-aa, aa, d);
```

### MSAA

Request MSAA context if available:
```javascript
const gl = canvas.getContext('webgl2', {
  antialias: true,  // Request MSAA
});
```

## Implementation Plan

### Phase 1: Foundation
1. WebGLRenderer class extending BaseRenderer
2. WebGL 2 context initialization
3. Basic shader compilation (TWGL)
4. Viewport transform setup
5. Background clearing

### Phase 2: Primitives
1. Rectangle rendering (SDF)
2. Circle rendering (SDF)
3. Line rendering (thick lines)
4. Per-shape material resolution

### Phase 3: Transforms
1. Transform tree traversal
2. World transform accumulation
3. Per-instance transform attributes

### Phase 4: Performance
1. Instanced rendering
2. Batching by primitive type
3. Draw order handling (z-buffer or sorting)

### Phase 5: Images
1. Texture loading via ResourceManager
2. Image primitive rendering
3. Cropping support

### Phase 6: Polish
1. toViewportCoords() for interaction
2. Resize handling
3. Error handling and fallbacks

## File Structure

```
src/
├── index.ts           # WebGLRenderer class, exports
├── shaders/
│   ├── circle.vert    # Circle vertex shader
│   ├── circle.frag    # Circle fragment shader (SDF)
│   ├── rect.vert      # Rectangle vertex shader
│   ├── rect.frag      # Rectangle fragment shader (SDF)
│   ├── line.vert      # Line vertex shader
│   ├── line.frag      # Line fragment shader
│   ├── image.vert     # Image vertex shader
│   └── image.frag     # Image fragment shader
├── pipeline.ts        # Shader program management
├── geometry.ts        # Quad geometry, instance buffers
└── transforms.ts      # Matrix utilities
```

## Known Limitations

### Transparency and Draw Order

The current design renders shapes in Frame tree traversal order without depth sorting. For scenes with overlapping transparent shapes, this means:

- Draw order is determined by position in the Frame tree
- No back-to-front sorting for correct alpha blending
- No order-independent transparency (OIT)

**Future consideration:** Implement separate opaque/transparent passes with sorting when transparency becomes a priority.

### Future Features

The following features are not supported and would require significant architectural work:

| Feature | Complexity | Notes |
|---------|------------|-------|
| Gradients | High | Per-instance gradient data, shader changes |
| Patterns | High | Texture sampling infrastructure |
| Filters (blur, shadow) | Very High | Multi-pass FBO rendering |
| Text | Very High | SDF font atlas, glyph caching |
| Blend modes | Medium | Per-shape blend state configuration |
| Dashed lines | Medium | Fragment shader or geometry |

These are recorded as design concerns for future iterations.

---

## Context Loss Handling

WebGL contexts can be lost at any time. The renderer must handle this robustly.

### Causes
- GPU memory pressure (common on mobile)
- Tab backgrounding (browser optimization)
- GPU driver crash/reset
- System sleep/wake cycles
- External GPU unplugged

### Required Implementation

```typescript
// In constructor
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();  // Critical: allows recovery
  this.contextLost = true;
});

canvas.addEventListener('webglcontextrestored', () => {
  this.recreateResources();
  this.contextLost = false;
});

// In render loop
if (this.contextLost) return;
```

### Resource Tracking

All GPU resources must be tracked for recreation:
- Shader programs (recompile from source)
- Vertex buffers (recreate with same geometry)
- Instance buffers (recreate, will be refilled on next frame)
- Textures (refetch and recreate via ResourceManager)

---

## Buffer Management Strategy

### Instance Buffers

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial capacity | 256 instances | Handles typical scenes |
| Growth factor | 2x | Amortized allocation cost |
| Growth trigger | count > capacity | Grow before overflow |
| Shrink policy | Never | Avoids thrashing |
| Maximum | 65,536 | WebGL index buffer limit |

```typescript
function ensureCapacity(buffer: InstanceBuffer, required: number): InstanceBuffer {
  if (required <= buffer.capacity) return buffer;

  const newCapacity = Math.min(
    Math.max(buffer.capacity * 2, required),
    65536
  );

  // Create new buffer, dispose old
  gl.deleteBuffer(buffer.glBuffer);
  return createInstanceBuffer(newCapacity);
}
```

### Static Buffers

Quad geometry buffer is created once at initialization and reused for all frames.

---

## References

- [TWGL.js Documentation](https://twgljs.org/)
- [WebGL2 Fundamentals](https://webgl2fundamentals.org/)
- [gl-matrix Documentation](https://glmatrix.net/)
- [The Book of Shaders - Shapes](https://thebookofshaders.com/07/)
- [WebGL Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
