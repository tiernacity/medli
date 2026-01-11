/**
 * WebGL 2 Renderer for medli
 *
 * Transforms Frame spec IR into WebGL draw calls using TWGL.js.
 * See DESIGN.md for architecture and implementation plan.
 *
 * @packageDocumentation
 */

import type {
  Generator,
  FrameNode,
  Material,
  Transform,
  Rectangle,
  Circle,
  Line,
  Image,
  RenderContext,
  BaseRendererMetrics,
} from "@medli/spec";
import { validateFrame, resolveMaterial } from "@medli/spec";
import {
  BaseRenderer,
  computeViewportTransform,
  extractResourceUrls,
  ResourceManager,
  toViewportCoords,
  type Point,
  type ViewportTransformResult,
} from "@medli/renderer-common";
import * as twgl from "twgl.js";
import { mat3 } from "gl-matrix";
import { memoize } from "es-toolkit";

// Shader sources as inline strings
const RECT_VERT = `#version 300 es
precision highp float;

// Quad vertices (unit square from -0.5 to 0.5)
in vec2 a_position;

// Per-instance attributes
in mat3 a_worldTransform;  // 3x3 matrix (uses 3 attribute slots)
in vec4 a_fillColor;
in vec4 a_strokeColor;
in float a_strokeWidth;
in vec2 a_size;  // width, height

// Uniforms
uniform mat3 u_viewportTransform;

// Varyings
out vec2 v_localPos;
out vec4 v_fillColor;
out vec4 v_strokeColor;
out float v_strokeWidth;
out vec2 v_size;

void main() {
  // Scale the unit quad by rectangle size plus stroke width
  // Stroke is centered on the edge, so we need strokeWidth/2 extra on each side
  vec2 quadSize = a_size + vec2(a_strokeWidth);
  vec2 localPos = a_position * quadSize;

  // Pass local position to fragment shader (in rectangle's local coords)
  v_localPos = localPos;
  v_size = a_size;
  v_fillColor = a_fillColor;
  v_strokeColor = a_strokeColor;
  v_strokeWidth = a_strokeWidth;

  // Transform to world coordinates
  vec3 worldPos = a_worldTransform * vec3(localPos, 1.0);

  // Transform to clip space
  vec3 clipPos = u_viewportTransform * worldPos;

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
}
`;

const RECT_FRAG = `#version 300 es
precision highp float;

in vec2 v_localPos;
in vec4 v_fillColor;
in vec4 v_strokeColor;
in float v_strokeWidth;
in vec2 v_size;

out vec4 fragColor;

// Box SDF: distance from point p to axis-aligned box of half-size b
// Uses Chebyshev distance (max of components) for sharp corners
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return max(d.x, d.y);
}

void main() {
  // Half-size of the rectangle
  vec2 halfSize = v_size * 0.5;

  // Signed distance to rectangle edge
  float d = sdBox(v_localPos, halfSize);

  // Anti-aliasing width based on screen-space derivatives
  float aa = fwidth(d);

  // Fill: inside the shape (d < 0)
  float fillAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Stroke: band centered on the edge (half inside, half outside)
  float halfStroke = v_strokeWidth * 0.5;
  float strokeOuter = d - halfStroke;  // Outer edge of stroke
  float strokeInner = d + halfStroke;  // Inner edge of stroke
  float strokeAlpha = (1.0 - smoothstep(-aa, aa, strokeOuter)) * smoothstep(-aa, aa, strokeInner);

  // Composite: stroke over fill
  // Premultiply RGB by color's own alpha, then apply SDF alpha for proper blending
  vec4 fillResult = vec4(v_fillColor.rgb * v_fillColor.a, v_fillColor.a) * fillAlpha;
  vec4 strokeResult = vec4(v_strokeColor.rgb * v_strokeColor.a, v_strokeColor.a) * strokeAlpha;

  // Blend stroke on top of fill (both already premultiplied)
  fragColor = fillResult * (1.0 - strokeResult.a) + strokeResult;

  // Discard fully transparent fragments
  if (fragColor.a < 0.001) discard;
}
`;

// Circle SDF shaders
const CIRCLE_VERT = `#version 300 es
precision highp float;

// Quad vertices (unit square from -0.5 to 0.5)
in vec2 a_position;

// Per-instance attributes
in mat3 a_worldTransform;  // 3x3 matrix (uses 3 attribute slots)
in vec4 a_fillColor;
in vec4 a_strokeColor;
in float a_strokeWidth;
in float a_radius;

// Uniforms
uniform mat3 u_viewportTransform;

// Varyings
out vec2 v_localPos;
out vec4 v_fillColor;
out vec4 v_strokeColor;
out float v_strokeWidth;
out float v_radius;

void main() {
  // Scale the unit quad to contain circle plus stroke
  // Quad needs to be (radius + strokeWidth) * 2 in each dimension
  float quadSize = (a_radius + a_strokeWidth) * 2.0;
  vec2 localPos = a_position * quadSize;

  // Pass local position to fragment shader (in circle's local coords)
  v_localPos = localPos;
  v_radius = a_radius;
  v_fillColor = a_fillColor;
  v_strokeColor = a_strokeColor;
  v_strokeWidth = a_strokeWidth;

  // Transform to world coordinates
  vec3 worldPos = a_worldTransform * vec3(localPos, 1.0);

  // Transform to clip space
  vec3 clipPos = u_viewportTransform * worldPos;

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
}
`;

const CIRCLE_FRAG = `#version 300 es
precision highp float;

in vec2 v_localPos;
in vec4 v_fillColor;
in vec4 v_strokeColor;
in float v_strokeWidth;
in float v_radius;

out vec4 fragColor;

// Circle SDF: distance from point p to circle of radius r centered at origin
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  // Signed distance to circle edge
  float d = sdCircle(v_localPos, v_radius);

  // Anti-aliasing width based on screen-space derivatives
  float aa = fwidth(d);

  // Fill: inside the shape (d < 0)
  float fillAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Stroke: band centered on the edge (half inside, half outside)
  float halfStroke = v_strokeWidth * 0.5;
  float strokeOuter = d - halfStroke;  // Outer edge of stroke
  float strokeInner = d + halfStroke;  // Inner edge of stroke
  float strokeAlpha = (1.0 - smoothstep(-aa, aa, strokeOuter)) * smoothstep(-aa, aa, strokeInner);

  // Composite: stroke over fill
  // Premultiply RGB by color's own alpha, then apply SDF alpha for proper blending
  vec4 fillResult = vec4(v_fillColor.rgb * v_fillColor.a, v_fillColor.a) * fillAlpha;
  vec4 strokeResult = vec4(v_strokeColor.rgb * v_strokeColor.a, v_strokeColor.a) * strokeAlpha;

  // Blend stroke on top of fill (both already premultiplied)
  fragColor = fillResult * (1.0 - strokeResult.a) + strokeResult;

  // Discard fully transparent fragments
  if (fragColor.a < 0.001) discard;
}
`;

// Line SDF shaders - thick lines rendered as quads with SDF
const LINE_VERT = `#version 300 es
precision highp float;

// Quad vertices (unit square from -0.5 to 0.5)
in vec2 a_position;

// Per-instance attributes
in mat3 a_worldTransform;  // 3x3 matrix (uses 3 attribute slots)
in vec4 a_strokeColor;
in float a_strokeWidth;
in vec2 a_startPoint;
in vec2 a_endPoint;

// Uniforms
uniform mat3 u_viewportTransform;

// Varyings
out vec2 v_localPos;
out vec4 v_strokeColor;
out float v_strokeWidth;
out vec2 v_startPoint;
out vec2 v_endPoint;

void main() {
  // Calculate line direction and perpendicular
  vec2 lineDir = a_endPoint - a_startPoint;
  float lineLen = length(lineDir);

  // Handle degenerate case (zero-length line)
  if (lineLen < 0.0001) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 dir = lineDir / lineLen;
  vec2 perp = vec2(-dir.y, dir.x);

  // Half-width for stroke
  float halfWidth = a_strokeWidth * 0.5;

  // Quad vertices: expand from unit quad to cover line + stroke width
  // a_position.x: along line direction (-0.5 to 0.5 maps to start-halfWidth to end+halfWidth)
  // a_position.y: perpendicular to line (-0.5 to 0.5 maps to -halfWidth to +halfWidth)

  // Map from [-0.5, 0.5] to line coordinates with padding for round caps
  float alongLine = (a_position.x + 0.5) * (lineLen + a_strokeWidth) - halfWidth;
  float perpOffset = a_position.y * a_strokeWidth;

  // Local position relative to line start (for fragment shader SDF)
  vec2 localPos = a_startPoint + dir * alongLine + perp * perpOffset;
  v_localPos = localPos;

  // Pass line endpoints in local coords to fragment shader
  v_startPoint = a_startPoint;
  v_endPoint = a_endPoint;
  v_strokeColor = a_strokeColor;
  v_strokeWidth = a_strokeWidth;

  // Transform to world coordinates
  vec3 worldPos = a_worldTransform * vec3(localPos, 1.0);

  // Transform to clip space
  vec3 clipPos = u_viewportTransform * worldPos;

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
}
`;

const LINE_FRAG = `#version 300 es
precision highp float;

in vec2 v_localPos;
in vec4 v_strokeColor;
in float v_strokeWidth;
in vec2 v_startPoint;
in vec2 v_endPoint;

out vec4 fragColor;

// SDF for line segment with butt caps (box shape instead of capsule)
// Returns signed distance to an oriented rectangle from a to b with given half-width
float sdLineButt(vec2 p, vec2 a, vec2 b, float halfWidth) {
  vec2 ba = b - a;
  float lineLen = length(ba);

  // Handle degenerate case (zero-length line)
  if (lineLen < 0.0001) {
    return length(p - a) - halfWidth;
  }

  vec2 dir = ba / lineLen;
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 pa = p - a;

  // Project point onto line's local coordinate system
  float alongLine = dot(pa, dir);
  float perpDist = abs(dot(pa, perp));

  // Box distance: clamp to rectangle bounds [0, lineLen] x [-halfWidth, halfWidth]
  float dAlong = max(-alongLine, alongLine - lineLen);
  float dPerp = perpDist - halfWidth;

  // Standard 2D box SDF combination
  vec2 d = vec2(max(dAlong, 0.0), max(dPerp, 0.0));
  return length(d) + min(max(dAlong, dPerp), 0.0);
}

void main() {
  // Half-width of the stroke
  float halfWidth = v_strokeWidth * 0.5;

  // Signed distance to line rectangle (butt caps)
  float d = sdLineButt(v_localPos, v_startPoint, v_endPoint, halfWidth);

  // Anti-aliasing width based on screen-space derivatives
  float aa = fwidth(d);

  // Stroke alpha with anti-aliased edge
  float strokeAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Premultiply RGB by color's own alpha, then apply SDF alpha for proper blending
  fragColor = vec4(v_strokeColor.rgb * v_strokeColor.a, v_strokeColor.a) * strokeAlpha;

  // Discard fully transparent fragments
  if (fragColor.a < 0.001) discard;
}
`;

// Image texture shaders
const IMAGE_VERT = `#version 300 es
precision highp float;

// Quad vertices (unit square from 0 to 1 for image UV mapping)
in vec2 a_position;

// Per-instance attributes
in mat3 a_worldTransform;  // 3x3 matrix (uses 3 attribute slots)
in vec2 a_imagePosition;   // Top-left corner position (in Y-up frame coords)
in vec2 a_imageSize;       // Width, height in viewport units
in vec4 a_uvRect;          // UV rectangle: x, y, width, height (0-1 range)

// Uniforms
uniform mat3 u_viewportTransform;

// Varyings
out vec2 v_uv;

void main() {
  // Map unit quad [0,1] to UV coordinates within the crop rect
  v_uv = a_uvRect.xy + a_position * a_uvRect.zw;

  // Map unit quad to image position and size
  // a_position is (0,0) to (1,1)
  // In Frame coords (Y-up), image position is top-left corner
  // Image extends from (x, y) to (x + width, y - height)
  // So we need to offset y by -height and then add (0 to height) based on a_position.y
  vec2 localPos = a_imagePosition + a_position * a_imageSize;

  // Transform to world coordinates
  vec3 worldPos = a_worldTransform * vec3(localPos, 1.0);

  // Transform to clip space
  vec3 clipPos = u_viewportTransform * worldPos;

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
}
`;

const IMAGE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
  // Sample texture with Y-flip (texture coords are Y-up, but textures load Y-down)
  vec2 flippedUV = vec2(v_uv.x, 1.0 - v_uv.y);
  fragColor = texture(u_texture, flippedUV);

  // Discard fully transparent fragments
  if (fragColor.a < 0.001) discard;
}
`;

/** Instance data for a rectangle */
interface RectInstance {
  worldTransform: mat3;
  fillColor: [number, number, number, number];
  strokeColor: [number, number, number, number];
  strokeWidth: number;
  size: [number, number];
}

/** Instance data for a circle */
interface CircleInstance {
  worldTransform: mat3;
  fillColor: [number, number, number, number];
  strokeColor: [number, number, number, number];
  strokeWidth: number;
  radius: number;
}

/** Instance data for a line */
interface LineInstance {
  worldTransform: mat3;
  strokeColor: [number, number, number, number];
  strokeWidth: number;
  startPoint: [number, number];
  endPoint: [number, number];
}

/** Instance data for an image */
interface ImageInstance {
  worldTransform: mat3;
  url: string;
  position: [number, number]; // Top-left corner (in Y-up frame coords, image extends downward)
  size: [number, number]; // Width, height
  /** Crop rect in source pixels, or null for full image */
  cropPixels: [number, number, number, number] | null;
}

/**
 * Ordered shape with type discriminator for tree-order rendering.
 * Shapes are collected in traversal order and batched by consecutive type.
 */
type OrderedShape =
  | { type: "rectangle"; instance: RectInstance }
  | { type: "circle"; instance: CircleInstance }
  | { type: "line"; instance: LineInstance }
  | { type: "image"; instance: ImageInstance };

/** WebGL texture with dimension metadata */
interface TextureWithDimensions {
  texture: WebGLTexture;
  width: number;
  height: number;
}

/**
 * Metrics specific to WebGL 2 rendering.
 * WebGL uses GPU-accelerated batch rendering with SDF shaders.
 */
export interface WebGLRendererMetrics extends BaseRendererMetrics {
  /**
   * GPU execution time from previous frame in milliseconds.
   * Uses EXT_disjoint_timer_query_webgl2 (1-frame delayed).
   * undefined if extension unavailable or timing invalid.
   */
  gpuTime: number | undefined;
  /** Number of instanced draw calls issued this frame */
  batchCount: number;
  /** Whether the GPU timer extension is available */
  gpuTimerAvailable: boolean;
}

// Lazy-initialized canvas for color parsing (reused across all calls)
let colorParserCanvas: HTMLCanvasElement | null = null;
let colorParserCtx: CanvasRenderingContext2D | null = null;

function getColorParserContext(): CanvasRenderingContext2D | null {
  if (!colorParserCtx) {
    colorParserCanvas = document.createElement("canvas");
    colorParserCanvas.width = 1;
    colorParserCanvas.height = 1;
    colorParserCtx = colorParserCanvas.getContext("2d");
  }
  return colorParserCtx;
}

/**
 * Parse a CSS color string to normalized RGBA values (0-1 range).
 * Supports: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb(), rgba(), named colors.
 */
function parseColorImpl(color: string): [number, number, number, number] {
  const ctx = getColorParserContext();
  if (!ctx) {
    return [0, 0, 0, 1]; // Fallback to black
  }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;

  return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
}

const parseColor = memoize(parseColorImpl);

/**
 * Expand 6-value 2D affine matrix to gl-matrix mat3 (column-major).
 * Frame: [a, b, c, d, e, f] where transform is:
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 *
 * gl-matrix mat3 is column-major:
 *   [col0_row0, col0_row1, col0_row2, col1_row0, col1_row1, col1_row2, col2_row0, col2_row1, col2_row2]
 *   = [a, b, 0, c, d, 0, e, f, 1]
 */
function expandMatrix(
  matrix: [number, number, number, number, number, number]
): mat3 {
  const [a, b, c, d, e, f] = matrix;
  const m = mat3.create();
  // Column 0
  m[0] = a;
  m[1] = b;
  m[2] = 0;
  // Column 1
  m[3] = c;
  m[4] = d;
  m[5] = 0;
  // Column 2
  m[6] = e;
  m[7] = f;
  m[8] = 1;
  return m;
}

/**
 * WebGL 2 Renderer for medli.
 *
 * Renders Frame spec IR using SDF-based primitives for resolution-independent
 * rendering with anti-aliased edges.
 */
export class WebGLRenderer extends BaseRenderer<WebGLRendererMetrics> {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private resizeObserver: ResizeObserver;
  private lastTransform: ViewportTransformResult | null = null;
  private contextLost = false;

  // WebGL resources
  private rectProgramInfo: twgl.ProgramInfo | null = null;
  private circleProgramInfo: twgl.ProgramInfo | null = null;
  private lineProgramInfo: twgl.ProgramInfo | null = null;
  private imageProgramInfo: twgl.ProgramInfo | null = null;
  private quadBufferInfo: twgl.BufferInfo | null = null;
  private imageQuadBufferInfo: twgl.BufferInfo | null = null;

  // GPU timing via EXT_disjoint_timer_query_webgl2
  private timerQueryExt: {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null = null;
  private pendingQuery: WebGLQuery | null = null;

  // Texture resource manager (stores textures with dimensions)
  private resourceManager: ResourceManager<TextureWithDimensions>;

  constructor(element: HTMLCanvasElement, generator: Generator) {
    super(generator, {
      frameTime: 0,
      generatorTime: 0,
      traversalTime: 0,
      resourceTime: 0,
      renderTime: 0,
      frameCount: 0,
      fps: undefined,
      shapeCount: 0,
      lastFrameTimestamp: 0,
      // WebGL-specific
      gpuTime: undefined,
      batchCount: 0,
      gpuTimerAvailable: false, // Set true after extension check
    });
    this.canvas = element;

    const gl = this.canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true, // Required for optional clear (no background) feature
    });

    if (!gl) {
      throw new Error("Could not get WebGL2 context from canvas");
    }
    this.gl = gl;

    // Initialize texture resource manager
    this.resourceManager = new ResourceManager({
      process: async (blob: Blob): Promise<TextureWithDimensions> => {
        // Create ImageBitmap from blob
        const bitmap = await createImageBitmap(blob);
        const width = bitmap.width;
        const height = bitmap.height;

        // Create WebGL texture
        const texture = gl.createTexture();
        if (!texture) {
          bitmap.close();
          throw new Error("Failed to create WebGL texture");
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bitmap
        );

        // Set texture parameters for non-power-of-2 textures
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        bitmap.close();
        return { texture, width, height };
      },
      dispose: (resource: TextureWithDimensions): void => {
        gl.deleteTexture(resource.texture);
      },
    });

    // Set up context loss handling
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored
    );

    // Initialize WebGL resources
    this.initResources();

    // Sync buffer size with CSS size (accounting for DPR)
    this.syncBufferSize();
    this.resizeObserver = new ResizeObserver(() => this.syncBufferSize());
    this.resizeObserver.observe(this.canvas);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault(); // Critical: allows recovery
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.initResources();
    this.contextLost = false;
  };

  /**
   * Initialize WebGL resources (programs, buffers).
   */
  private initResources(): void {
    const gl = this.gl;

    // Create shader programs with error checking
    // Note: twgl.createProgramInfo logs shader errors to console
    this.rectProgramInfo = twgl.createProgramInfo(gl, [RECT_VERT, RECT_FRAG]);
    this.circleProgramInfo = twgl.createProgramInfo(gl, [
      CIRCLE_VERT,
      CIRCLE_FRAG,
    ]);
    this.lineProgramInfo = twgl.createProgramInfo(gl, [LINE_VERT, LINE_FRAG]);
    this.imageProgramInfo = twgl.createProgramInfo(gl, [
      IMAGE_VERT,
      IMAGE_FRAG,
    ]);

    // Create unit quad geometry (from -0.5 to 0.5) for SDF shapes
    // Two triangles forming a square
    const positions = new Float32Array([
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ]);

    this.quadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 2, data: positions },
    });

    // Create unit quad geometry (from 0 to 1) for image UV mapping
    // Two triangles forming a square
    const imagePositions = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
    ]);

    this.imageQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 2, data: imagePositions },
    });

    // Enable blending for transparency
    // Use premultiplied alpha blending: shaders output RGB*A, so source factor is ONE (not SRC_ALPHA)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Try to get timer query extension for GPU timing metrics
    // This extension may not be available on all hardware/drivers
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    if (ext) {
      this.timerQueryExt = {
        TIME_ELAPSED_EXT: ext.TIME_ELAPSED_EXT,
        GPU_DISJOINT_EXT: ext.GPU_DISJOINT_EXT,
      };
      // Update metrics to reflect that GPU timing is available
      this._metrics = { ...this._metrics, gpuTimerAvailable: true };
    }
  }

  /**
   * Sync the canvas buffer size with its CSS size, accounting for device pixel ratio.
   */
  private syncBufferSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  async render(time: number = 0): Promise<void> {
    // Start metrics collection
    this.startMetricsFrame(time);
    // Reset WebGL-specific metrics for this frame
    this._metrics = { ...this._metrics, batchCount: 0 };

    // Skip rendering if context is lost
    if (this.contextLost) {
      this.endMetricsFrame();
      return;
    }

    const gl = this.gl;

    // Check for GPU timing result from previous frame (1-frame delayed)
    this.pollPendingGpuTime();

    // Build RenderContext with CSS pixel dimensions
    const rect = this.canvas.getBoundingClientRect();
    const context: RenderContext = {
      time,
      targetDimensions: [rect.width, rect.height],
    };

    // Time generator.frame()
    const genStart = performance.now();
    const frame = this.generator.frame(context);
    this.recordGeneratorTime(performance.now() - genStart);

    // Validate frame structure (fail fast)
    const result = validateFrame(frame);
    if (!result.valid) {
      console.error("Invalid frame:", result.error);
      this.endMetricsFrame();
      return;
    }

    // Extract and load resources (timed)
    const urls = extractResourceUrls(frame);
    let resourceMap: Map<string, TextureWithDimensions>;
    const resourceStart = performance.now();
    try {
      resourceMap = await this.resourceManager.resolveResources(urls);
    } catch (error) {
      console.error("Failed to load resources:", error);
      this.recordResourceTime(performance.now() - resourceStart);
      this.endMetricsFrame();
      return;
    }
    this.recordResourceTime(performance.now() - resourceStart);

    // Set viewport to canvas size
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Clear canvas with background color (if defined)
    if (frame.background !== undefined) {
      const bgColor = parseColor(frame.background);
      gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Compute viewport transform
    const vp = frame.viewport;
    const transform = computeViewportTransform(
      vp,
      this.canvas.width,
      this.canvas.height
    );
    this.lastTransform = transform;

    // Build viewport transform matrix for WebGL (clip space is -1 to 1)
    // Transform: viewport coords → clip space
    // 1. Scale by 2/element size (element coords → [-1, 1])
    // 2. Apply scaleX/scaleY from viewport transform
    // 3. Y-flip (WebGL Y-up, but we want to match DOM Y-down after viewport transform)
    const viewportMatrix = mat3.create();

    // The viewport transform scales and translates to element coords
    // For WebGL clip space, we need:
    // - Divide by halfWidth/halfHeight to normalize viewport coords to [-1, 1]
    // Note: No Y-flip needed - WebGL clip space is Y-up, same as Frame viewport coords

    const scaleX = transform.scaleX / (this.canvas.width / 2);
    const scaleY = transform.scaleY / (this.canvas.height / 2); // No Y-flip: WebGL clip space is Y-up, same as Frame

    mat3.set(viewportMatrix, scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1);

    // Collect shape instances from frame tree in traversal order (timed)
    const traversalStart = performance.now();
    const orderedShapes: OrderedShape[] = [];
    this.traverseNode(frame.root, [frame.root], mat3.create(), orderedShapes);
    this.recordTraversalTime(performance.now() - traversalStart);

    // Render shapes in tree order with smart batching (timed)
    // Note: renderTime measures CPU time to submit WebGL draw calls, not actual GPU
    // execution time. gpuTime (when available) measures actual GPU execution time
    // from the previous frame via EXT_disjoint_timer_query_webgl2.
    const renderStart = performance.now();

    // Begin GPU timer query if extension is available
    const query = this.beginGpuTimer();

    const batchCount = this.renderOrderedShapes(
      orderedShapes,
      viewportMatrix,
      resourceMap
    );

    // End GPU timer query
    this.endGpuTimer(query);

    this.recordRenderTime(performance.now() - renderStart);

    // Record shape and batch counts
    this.recordShapeCount(orderedShapes.length);
    this._metrics = { ...this._metrics, batchCount };

    // Finalize metrics
    this.endMetricsFrame();
  }

  /**
   * Poll the pending GPU timer query for results from the previous frame.
   * Results are 1-frame delayed since GPU work is asynchronous.
   */
  private pollPendingGpuTime(): void {
    const gl = this.gl;

    if (!this.timerQueryExt || !this.pendingQuery) {
      // No extension or no pending query - gpuTime stays undefined
      return;
    }

    // Check if the query result is available
    const available = gl.getQueryParameter(
      this.pendingQuery,
      gl.QUERY_RESULT_AVAILABLE
    );

    if (!available) {
      // Result not ready yet - will try again next frame
      return;
    }

    // Check for GPU disjoint (timing may be invalid due to power management, etc.)
    const disjoint = gl.getParameter(this.timerQueryExt.GPU_DISJOINT_EXT);
    if (disjoint) {
      // Timing data is invalid - delete query and record undefined
      gl.deleteQuery(this.pendingQuery);
      this.pendingQuery = null;
      this._metrics = { ...this._metrics, gpuTime: undefined };
      return;
    }

    // Get the query result (in nanoseconds) and convert to milliseconds
    const timeNanos = gl.getQueryParameter(
      this.pendingQuery,
      gl.QUERY_RESULT
    ) as number;
    const timeMs = timeNanos / 1_000_000;

    // Clean up query and record the GPU time
    gl.deleteQuery(this.pendingQuery);
    this.pendingQuery = null;
    this._metrics = { ...this._metrics, gpuTime: timeMs };
  }

  /**
   * Begin a GPU timer query for measuring draw call execution time.
   * @returns The query object, or null if extension unavailable
   */
  private beginGpuTimer(): WebGLQuery | null {
    const gl = this.gl;

    if (!this.timerQueryExt) {
      return null;
    }

    // Create and begin the timer query
    const query = gl.createQuery();
    if (!query) {
      return null;
    }

    gl.beginQuery(this.timerQueryExt.TIME_ELAPSED_EXT, query);
    return query;
  }

  /**
   * End the GPU timer query and store it for reading next frame.
   * @param query The query object from beginGpuTimer, or null
   */
  private endGpuTimer(query: WebGLQuery | null): void {
    const gl = this.gl;

    if (!this.timerQueryExt || !query) {
      return;
    }

    gl.endQuery(this.timerQueryExt.TIME_ELAPSED_EXT);

    // Delete previous pending query if it exists (shouldn't happen normally)
    if (this.pendingQuery) {
      gl.deleteQuery(this.pendingQuery);
    }

    // Store query for reading next frame
    this.pendingQuery = query;
  }

  /**
   * Traverse the frame tree, collecting shape instances in traversal order
   * with resolved materials and transforms.
   */
  private traverseNode(
    node: FrameNode,
    ancestors: Material[],
    parentTransform: mat3,
    orderedShapes: OrderedShape[]
  ): void {
    if (node.type === "material") {
      const material = node as Material;
      for (const child of material.children) {
        if (child.type === "material") {
          this.traverseNode(
            child,
            [...ancestors, child as Material],
            parentTransform,
            orderedShapes
          );
        } else {
          this.traverseNode(child, ancestors, parentTransform, orderedShapes);
        }
      }
    } else if (node.type === "transform") {
      const transform = node as Transform;
      const localMatrix = expandMatrix(transform.matrix);
      const worldMatrix = mat3.create();
      mat3.multiply(worldMatrix, parentTransform, localMatrix);

      for (const child of transform.children) {
        if (child.type === "material") {
          this.traverseNode(
            child,
            [...ancestors, child as Material],
            worldMatrix,
            orderedShapes
          );
        } else {
          this.traverseNode(child, ancestors, worldMatrix, orderedShapes);
        }
      }
    } else if (node.type === "rectangle") {
      const rect = node as Rectangle;
      const resolved = resolveMaterial(ancestors);

      // Create world transform that includes the rectangle's center position
      const worldMatrix = mat3.create();
      mat3.copy(worldMatrix, parentTransform);
      mat3.translate(worldMatrix, worldMatrix, [rect.center.x, rect.center.y]);

      orderedShapes.push({
        type: "rectangle",
        instance: {
          worldTransform: worldMatrix,
          fillColor: parseColor(resolved.fill),
          strokeColor: parseColor(resolved.stroke),
          strokeWidth: resolved.strokeWidth,
          size: [rect.width, rect.height],
        },
      });
    } else if (node.type === "circle") {
      const circle = node as Circle;
      const resolved = resolveMaterial(ancestors);

      // Create world transform that includes the circle's center position
      const worldMatrix = mat3.create();
      mat3.copy(worldMatrix, parentTransform);
      mat3.translate(worldMatrix, worldMatrix, [
        circle.center.x,
        circle.center.y,
      ]);

      orderedShapes.push({
        type: "circle",
        instance: {
          worldTransform: worldMatrix,
          fillColor: parseColor(resolved.fill),
          strokeColor: parseColor(resolved.stroke),
          strokeWidth: resolved.strokeWidth,
          radius: circle.radius,
        },
      });
    } else if (node.type === "line") {
      const line = node as Line;
      const resolved = resolveMaterial(ancestors);

      // Lines use the parent transform directly (no center translation)
      // The start and end points are in local coordinates
      const worldMatrix = mat3.create();
      mat3.copy(worldMatrix, parentTransform);

      orderedShapes.push({
        type: "line",
        instance: {
          worldTransform: worldMatrix,
          strokeColor: parseColor(resolved.stroke),
          strokeWidth: resolved.strokeWidth,
          startPoint: [line.start.x, line.start.y],
          endPoint: [line.end.x, line.end.y],
        },
      });
    } else if (node.type === "image") {
      const img = node as Image;

      // Images use the parent transform directly
      const worldMatrix = mat3.create();
      mat3.copy(worldMatrix, parentTransform);

      // Store crop rect in pixels (or null for full image)
      // Conversion to UV coordinates happens during rendering when we have texture dimensions
      const cropPixels: [number, number, number, number] | null = img.crop
        ? [img.crop.x, img.crop.y, img.crop.width, img.crop.height]
        : null;

      orderedShapes.push({
        type: "image",
        instance: {
          worldTransform: worldMatrix,
          url: img.url,
          position: [img.position.x, img.position.y - img.height],
          size: [img.width, img.height],
          cropPixels,
        },
      });
    }
  }

  /**
   * Render shapes in tree traversal order with smart batching.
   * Consecutive shapes of the same type are batched together for efficient
   * instanced rendering while maintaining correct z-order (painter's algorithm).
   *
   * Example: [rect, rect, circle, line, line, line, circle, rect] renders as:
   * 1. renderRectangles([rect, rect])
   * 2. renderCircles([circle])
   * 3. renderLines([line, line, line])
   * 4. renderCircles([circle])
   * 5. renderRectangles([rect])
   *
   * @returns The number of batches (draw calls) issued
   */
  private renderOrderedShapes(
    shapes: OrderedShape[],
    viewportMatrix: mat3,
    resourceMap: Map<string, TextureWithDimensions>
  ): number {
    if (shapes.length === 0) return 0;

    let batchStart = 0;
    let currentType = shapes[0].type;
    let batchCount = 0;

    for (let i = 1; i <= shapes.length; i++) {
      // Check if we've reached the end or a type change
      const isEnd = i === shapes.length;
      const typeChanged = !isEnd && shapes[i].type !== currentType;

      if (isEnd || typeChanged) {
        // Render the batch from batchStart to i (exclusive)
        const batch = shapes.slice(batchStart, i);
        batchCount += this.renderBatch(
          batch,
          currentType,
          viewportMatrix,
          resourceMap
        );

        // Start new batch if not at end
        if (!isEnd) {
          batchStart = i;
          currentType = shapes[i].type;
        }
      }
    }

    return batchCount;
  }

  /**
   * Render a batch of shapes of the same type.
   * @returns The number of draw calls issued
   */
  private renderBatch(
    batch: OrderedShape[],
    type: OrderedShape["type"],
    viewportMatrix: mat3,
    resourceMap: Map<string, TextureWithDimensions>
  ): number {
    switch (type) {
      case "rectangle": {
        const instances = batch.map(
          (s) => (s as { type: "rectangle"; instance: RectInstance }).instance
        );
        this.renderRectangles(instances, viewportMatrix);
        return 1; // Single instanced draw call
      }
      case "circle": {
        const instances = batch.map(
          (s) => (s as { type: "circle"; instance: CircleInstance }).instance
        );
        this.renderCircles(instances, viewportMatrix);
        return 1; // Single instanced draw call
      }
      case "line": {
        const instances = batch.map(
          (s) => (s as { type: "line"; instance: LineInstance }).instance
        );
        this.renderLines(instances, viewportMatrix);
        return 1; // Single instanced draw call
      }
      case "image": {
        const instances = batch.map(
          (s) => (s as { type: "image"; instance: ImageInstance }).instance
        );
        return this.renderImages(instances, viewportMatrix, resourceMap);
      }
    }
  }

  /**
   * Render all rectangles using instanced drawing.
   */
  private renderRectangles(
    instances: RectInstance[],
    viewportMatrix: mat3
  ): void {
    if (instances.length === 0) return;
    if (!this.rectProgramInfo || !this.quadBufferInfo) return;

    const gl = this.gl;

    gl.useProgram(this.rectProgramInfo.program);

    // Set uniforms
    twgl.setUniforms(this.rectProgramInfo, {
      u_viewportTransform: viewportMatrix,
    });

    // Prepare instance data arrays
    // mat3 requires 9 floats per instance (but GLSL mat3 attribute uses 3 vec3s)
    const transformData = new Float32Array(instances.length * 9);
    const fillColorData = new Float32Array(instances.length * 4);
    const strokeColorData = new Float32Array(instances.length * 4);
    const strokeWidthData = new Float32Array(instances.length);
    const sizeData = new Float32Array(instances.length * 2);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];

      // Copy mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        transformData[i * 9 + j] = inst.worldTransform[j];
      }

      // Copy colors
      fillColorData[i * 4 + 0] = inst.fillColor[0];
      fillColorData[i * 4 + 1] = inst.fillColor[1];
      fillColorData[i * 4 + 2] = inst.fillColor[2];
      fillColorData[i * 4 + 3] = inst.fillColor[3];

      strokeColorData[i * 4 + 0] = inst.strokeColor[0];
      strokeColorData[i * 4 + 1] = inst.strokeColor[1];
      strokeColorData[i * 4 + 2] = inst.strokeColor[2];
      strokeColorData[i * 4 + 3] = inst.strokeColor[3];

      strokeWidthData[i] = inst.strokeWidth;

      sizeData[i * 2 + 0] = inst.size[0];
      sizeData[i * 2 + 1] = inst.size[1];
    }

    // Get attribute locations
    const program = this.rectProgramInfo.program;
    const a_position = gl.getAttribLocation(program, "a_position");
    const a_worldTransform = gl.getAttribLocation(program, "a_worldTransform");
    const a_fillColor = gl.getAttribLocation(program, "a_fillColor");
    const a_strokeColor = gl.getAttribLocation(program, "a_strokeColor");
    const a_strokeWidth = gl.getAttribLocation(program, "a_strokeWidth");
    const a_size = gl.getAttribLocation(program, "a_size");

    // Set up quad vertex buffer (shared across all instances)
    const positionBuffer = this.quadBufferInfo.attribs!.a_position.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_position, 0); // Per-vertex

    // Create and bind instance buffers
    // Transform matrix (mat3 = 3 vec3 attributes)
    const transformBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, transformBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, transformData, gl.DYNAMIC_DRAW);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        3,
        gl.FLOAT,
        false,
        9 * 4, // stride: 9 floats * 4 bytes
        col * 3 * 4 // offset: column * 3 floats * 4 bytes
      );
      gl.vertexAttribDivisor(loc, 1); // Per-instance
    }

    // Fill color
    const fillColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fillColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_fillColor);
    gl.vertexAttribPointer(a_fillColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_fillColor, 1);

    // Stroke color
    const strokeColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeColor);
    gl.vertexAttribPointer(a_strokeColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeColor, 1);

    // Stroke width
    const strokeWidthBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeWidthData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribPointer(a_strokeWidth, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeWidth, 1);

    // Size
    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_size);
    gl.vertexAttribPointer(a_size, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_size, 1);

    // Draw all instances
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length);

    // Clean up instance buffers
    gl.deleteBuffer(transformBuffer);
    gl.deleteBuffer(fillColorBuffer);
    gl.deleteBuffer(strokeColorBuffer);
    gl.deleteBuffer(strokeWidthBuffer);
    gl.deleteBuffer(sizeBuffer);

    // Reset attribute divisors and disable attribute arrays
    // This is critical to prevent state from bleeding into subsequent render calls
    gl.vertexAttribDivisor(a_position, 0);
    gl.disableVertexAttribArray(a_position);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.vertexAttribDivisor(loc, 0);
      gl.disableVertexAttribArray(loc);
    }
    gl.vertexAttribDivisor(a_fillColor, 0);
    gl.disableVertexAttribArray(a_fillColor);
    gl.vertexAttribDivisor(a_strokeColor, 0);
    gl.disableVertexAttribArray(a_strokeColor);
    gl.vertexAttribDivisor(a_strokeWidth, 0);
    gl.disableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribDivisor(a_size, 0);
    gl.disableVertexAttribArray(a_size);
  }

  /**
   * Render all circles using instanced drawing.
   */
  private renderCircles(
    instances: CircleInstance[],
    viewportMatrix: mat3
  ): void {
    if (instances.length === 0) return;
    if (!this.circleProgramInfo || !this.quadBufferInfo) return;

    const gl = this.gl;

    gl.useProgram(this.circleProgramInfo.program);

    // Set uniforms
    twgl.setUniforms(this.circleProgramInfo, {
      u_viewportTransform: viewportMatrix,
    });

    // Prepare instance data arrays
    const transformData = new Float32Array(instances.length * 9);
    const fillColorData = new Float32Array(instances.length * 4);
    const strokeColorData = new Float32Array(instances.length * 4);
    const strokeWidthData = new Float32Array(instances.length);
    const radiusData = new Float32Array(instances.length);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];

      // Copy mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        transformData[i * 9 + j] = inst.worldTransform[j];
      }

      // Copy colors
      fillColorData[i * 4 + 0] = inst.fillColor[0];
      fillColorData[i * 4 + 1] = inst.fillColor[1];
      fillColorData[i * 4 + 2] = inst.fillColor[2];
      fillColorData[i * 4 + 3] = inst.fillColor[3];

      strokeColorData[i * 4 + 0] = inst.strokeColor[0];
      strokeColorData[i * 4 + 1] = inst.strokeColor[1];
      strokeColorData[i * 4 + 2] = inst.strokeColor[2];
      strokeColorData[i * 4 + 3] = inst.strokeColor[3];

      strokeWidthData[i] = inst.strokeWidth;
      radiusData[i] = inst.radius;
    }

    // Get attribute locations
    const program = this.circleProgramInfo.program;
    const a_position = gl.getAttribLocation(program, "a_position");
    const a_worldTransform = gl.getAttribLocation(program, "a_worldTransform");
    const a_fillColor = gl.getAttribLocation(program, "a_fillColor");
    const a_strokeColor = gl.getAttribLocation(program, "a_strokeColor");
    const a_strokeWidth = gl.getAttribLocation(program, "a_strokeWidth");
    const a_radius = gl.getAttribLocation(program, "a_radius");

    // Set up quad vertex buffer (shared across all instances)
    const positionBuffer = this.quadBufferInfo.attribs!.a_position.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_position, 0); // Per-vertex

    // Create and bind instance buffers
    // Transform matrix (mat3 = 3 vec3 attributes)
    const transformBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, transformBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, transformData, gl.DYNAMIC_DRAW);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        3,
        gl.FLOAT,
        false,
        9 * 4, // stride: 9 floats * 4 bytes
        col * 3 * 4 // offset: column * 3 floats * 4 bytes
      );
      gl.vertexAttribDivisor(loc, 1); // Per-instance
    }

    // Fill color
    const fillColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fillColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_fillColor);
    gl.vertexAttribPointer(a_fillColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_fillColor, 1);

    // Stroke color
    const strokeColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeColor);
    gl.vertexAttribPointer(a_strokeColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeColor, 1);

    // Stroke width
    const strokeWidthBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeWidthData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribPointer(a_strokeWidth, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeWidth, 1);

    // Radius
    const radiusBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, radiusData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_radius);
    gl.vertexAttribPointer(a_radius, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_radius, 1);

    // Draw all instances
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length);

    // Clean up instance buffers
    gl.deleteBuffer(transformBuffer);
    gl.deleteBuffer(fillColorBuffer);
    gl.deleteBuffer(strokeColorBuffer);
    gl.deleteBuffer(strokeWidthBuffer);
    gl.deleteBuffer(radiusBuffer);

    // Reset attribute divisors and disable attribute arrays
    gl.vertexAttribDivisor(a_position, 0);
    gl.disableVertexAttribArray(a_position);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.vertexAttribDivisor(loc, 0);
      gl.disableVertexAttribArray(loc);
    }
    gl.vertexAttribDivisor(a_fillColor, 0);
    gl.disableVertexAttribArray(a_fillColor);
    gl.vertexAttribDivisor(a_strokeColor, 0);
    gl.disableVertexAttribArray(a_strokeColor);
    gl.vertexAttribDivisor(a_strokeWidth, 0);
    gl.disableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribDivisor(a_radius, 0);
    gl.disableVertexAttribArray(a_radius);
  }

  /**
   * Render all lines using instanced drawing.
   */
  private renderLines(instances: LineInstance[], viewportMatrix: mat3): void {
    if (instances.length === 0) return;
    if (!this.lineProgramInfo || !this.quadBufferInfo) return;

    const gl = this.gl;

    gl.useProgram(this.lineProgramInfo.program);

    // Set uniforms
    twgl.setUniforms(this.lineProgramInfo, {
      u_viewportTransform: viewportMatrix,
    });

    // Prepare instance data arrays
    const transformData = new Float32Array(instances.length * 9);
    const strokeColorData = new Float32Array(instances.length * 4);
    const strokeWidthData = new Float32Array(instances.length);
    const startPointData = new Float32Array(instances.length * 2);
    const endPointData = new Float32Array(instances.length * 2);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];

      // Copy mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        transformData[i * 9 + j] = inst.worldTransform[j];
      }

      // Copy stroke color
      strokeColorData[i * 4 + 0] = inst.strokeColor[0];
      strokeColorData[i * 4 + 1] = inst.strokeColor[1];
      strokeColorData[i * 4 + 2] = inst.strokeColor[2];
      strokeColorData[i * 4 + 3] = inst.strokeColor[3];

      strokeWidthData[i] = inst.strokeWidth;

      // Copy start and end points
      startPointData[i * 2 + 0] = inst.startPoint[0];
      startPointData[i * 2 + 1] = inst.startPoint[1];
      endPointData[i * 2 + 0] = inst.endPoint[0];
      endPointData[i * 2 + 1] = inst.endPoint[1];
    }

    // Get attribute locations
    const program = this.lineProgramInfo.program;
    const a_position = gl.getAttribLocation(program, "a_position");
    const a_worldTransform = gl.getAttribLocation(program, "a_worldTransform");
    const a_strokeColor = gl.getAttribLocation(program, "a_strokeColor");
    const a_strokeWidth = gl.getAttribLocation(program, "a_strokeWidth");
    const a_startPoint = gl.getAttribLocation(program, "a_startPoint");
    const a_endPoint = gl.getAttribLocation(program, "a_endPoint");

    // Set up quad vertex buffer (shared across all instances)
    const positionBuffer = this.quadBufferInfo.attribs!.a_position.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_position, 0); // Per-vertex

    // Create and bind instance buffers
    // Transform matrix (mat3 = 3 vec3 attributes)
    const transformBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, transformBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, transformData, gl.DYNAMIC_DRAW);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        3,
        gl.FLOAT,
        false,
        9 * 4, // stride: 9 floats * 4 bytes
        col * 3 * 4 // offset: column * 3 floats * 4 bytes
      );
      gl.vertexAttribDivisor(loc, 1); // Per-instance
    }

    // Stroke color
    const strokeColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeColor);
    gl.vertexAttribPointer(a_strokeColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeColor, 1);

    // Stroke width
    const strokeWidthBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strokeWidthData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribPointer(a_strokeWidth, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_strokeWidth, 1);

    // Start point
    const startPointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, startPointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, startPointData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_startPoint);
    gl.vertexAttribPointer(a_startPoint, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_startPoint, 1);

    // End point
    const endPointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, endPointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, endPointData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a_endPoint);
    gl.vertexAttribPointer(a_endPoint, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_endPoint, 1);

    // Draw all instances
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length);

    // Clean up instance buffers
    gl.deleteBuffer(transformBuffer);
    gl.deleteBuffer(strokeColorBuffer);
    gl.deleteBuffer(strokeWidthBuffer);
    gl.deleteBuffer(startPointBuffer);
    gl.deleteBuffer(endPointBuffer);

    // Reset attribute divisors and disable attribute arrays
    gl.vertexAttribDivisor(a_position, 0);
    gl.disableVertexAttribArray(a_position);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.vertexAttribDivisor(loc, 0);
      gl.disableVertexAttribArray(loc);
    }
    gl.vertexAttribDivisor(a_strokeColor, 0);
    gl.disableVertexAttribArray(a_strokeColor);
    gl.vertexAttribDivisor(a_strokeWidth, 0);
    gl.disableVertexAttribArray(a_strokeWidth);
    gl.vertexAttribDivisor(a_startPoint, 0);
    gl.disableVertexAttribArray(a_startPoint);
    gl.vertexAttribDivisor(a_endPoint, 0);
    gl.disableVertexAttribArray(a_endPoint);
  }

  /**
   * Render all images.
   * Images are rendered one at a time since each may have a different texture.
   * For better performance with many images sharing textures, batching could be added.
   * @returns The number of draw calls issued
   */
  private renderImages(
    instances: ImageInstance[],
    viewportMatrix: mat3,
    resourceMap: Map<string, TextureWithDimensions>
  ): number {
    if (instances.length === 0) return 0;
    if (!this.imageProgramInfo || !this.imageQuadBufferInfo) return 0;

    const gl = this.gl;

    gl.useProgram(this.imageProgramInfo.program);

    // Get attribute locations
    const program = this.imageProgramInfo.program;
    const a_position = gl.getAttribLocation(program, "a_position");
    const a_worldTransform = gl.getAttribLocation(program, "a_worldTransform");
    const a_imagePosition = gl.getAttribLocation(program, "a_imagePosition");
    const a_imageSize = gl.getAttribLocation(program, "a_imageSize");
    const a_uvRect = gl.getAttribLocation(program, "a_uvRect");

    // Set up quad vertex buffer
    const positionBuffer = this.imageQuadBufferInfo.attribs!.a_position.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_position, 0); // Per-vertex

    // Count draw calls for metrics
    let drawCallCount = 0;

    // Render each image
    for (const inst of instances) {
      const resource = resourceMap.get(inst.url);
      if (!resource) continue; // Skip if texture not loaded

      // Set uniforms - pass texture object directly, TWGL will bind it
      twgl.setUniforms(this.imageProgramInfo, {
        u_viewportTransform: viewportMatrix,
        u_texture: resource.texture,
      });

      // Calculate UV rect from crop pixels using texture dimensions
      let uvRect: [number, number, number, number];
      if (inst.cropPixels) {
        // Convert pixel coordinates to UV (0-1) range
        const [cropX, cropY, cropW, cropH] = inst.cropPixels;
        uvRect = [
          cropX / resource.width,
          cropY / resource.height,
          cropW / resource.width,
          cropH / resource.height,
        ];
      } else {
        // Full texture
        uvRect = [0, 0, 1, 1];
      }

      // Create instance data for single image
      const transformData = new Float32Array(9);
      for (let j = 0; j < 9; j++) {
        transformData[j] = inst.worldTransform[j];
      }

      // Create and bind instance buffers
      const transformBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, transformBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, transformData, gl.DYNAMIC_DRAW);
      for (let col = 0; col < 3; col++) {
        const loc = a_worldTransform + col;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 9 * 4, col * 3 * 4);
        gl.vertexAttribDivisor(loc, 1);
      }

      // Image position
      const positionData = new Float32Array(inst.position);
      const imagePositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positionData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_imagePosition);
      gl.vertexAttribPointer(a_imagePosition, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(a_imagePosition, 1);

      // Image size
      const sizeData = new Float32Array(inst.size);
      const imageSizeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, imageSizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_imageSize);
      gl.vertexAttribPointer(a_imageSize, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(a_imageSize, 1);

      // UV rect
      const uvRectData = new Float32Array(uvRect);
      const uvRectBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvRectBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uvRectData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_uvRect);
      gl.vertexAttribPointer(a_uvRect, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(a_uvRect, 1);

      // Draw single image instance
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 1);
      drawCallCount++;

      // Clean up buffers
      gl.deleteBuffer(transformBuffer);
      gl.deleteBuffer(imagePositionBuffer);
      gl.deleteBuffer(imageSizeBuffer);
      gl.deleteBuffer(uvRectBuffer);
    }

    // Reset attribute divisors and disable attribute arrays
    gl.vertexAttribDivisor(a_position, 0);
    gl.disableVertexAttribArray(a_position);
    for (let col = 0; col < 3; col++) {
      const loc = a_worldTransform + col;
      gl.vertexAttribDivisor(loc, 0);
      gl.disableVertexAttribArray(loc);
    }
    gl.vertexAttribDivisor(a_imagePosition, 0);
    gl.disableVertexAttribArray(a_imagePosition);
    gl.vertexAttribDivisor(a_imageSize, 0);
    gl.disableVertexAttribArray(a_imageSize);
    gl.vertexAttribDivisor(a_uvRect, 0);
    gl.disableVertexAttribArray(a_uvRect);

    return drawCallCount;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();

    // Remove event listeners
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored
    );

    // Clean up texture resources
    this.resourceManager.destroy();

    // Clean up pending GPU timer query
    if (this.pendingQuery) {
      this.gl.deleteQuery(this.pendingQuery);
      this.pendingQuery = null;
    }

    // Clean up WebGL resources
    const gl = this.gl;
    if (this.rectProgramInfo) {
      gl.deleteProgram(this.rectProgramInfo.program);
      this.rectProgramInfo = null;
    }
    if (this.circleProgramInfo) {
      gl.deleteProgram(this.circleProgramInfo.program);
      this.circleProgramInfo = null;
    }
    if (this.lineProgramInfo) {
      gl.deleteProgram(this.lineProgramInfo.program);
      this.lineProgramInfo = null;
    }
    if (this.imageProgramInfo) {
      gl.deleteProgram(this.imageProgramInfo.program);
      this.imageProgramInfo = null;
    }
    if (this.quadBufferInfo) {
      const attribs = this.quadBufferInfo.attribs;
      if (attribs) {
        for (const key in attribs) {
          const buffer = attribs[key].buffer;
          if (buffer) gl.deleteBuffer(buffer);
        }
      }
      this.quadBufferInfo = null;
    }
    if (this.imageQuadBufferInfo) {
      const attribs = this.imageQuadBufferInfo.attribs;
      if (attribs) {
        for (const key in attribs) {
          const buffer = attribs[key].buffer;
          if (buffer) gl.deleteBuffer(buffer);
        }
      }
      this.imageQuadBufferInfo = null;
    }
  }

  /**
   * Convert CSS pixel coordinates to frame (viewport) coordinates.
   * Automatically handles DPR scaling internally.
   * @param input - Single point [x, y] in CSS pixels relative to element
   * @returns Transformed point in frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords(input: Point): Point;
  /**
   * Convert an array of CSS pixel coordinates to frame (viewport) coordinates.
   * Automatically handles DPR scaling internally.
   * @param input - Array of points [[x, y], ...] in CSS pixels relative to element
   * @returns Array of transformed points in frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords(input: Point[]): Point[];
  /**
   * Convert a record of CSS pixel coordinates to frame (viewport) coordinates.
   * Automatically handles DPR scaling internally.
   * @param input - Record mapping keys to points in CSS pixels relative to element
   * @returns Record with same keys, values transformed to frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords<K extends string>(input: Record<K, Point>): Record<K, Point>;
  /**
   * Convert a map of CSS pixel coordinates to frame (viewport) coordinates.
   * Automatically handles DPR scaling internally.
   * @param input - Map from keys to points in CSS pixels relative to element
   * @returns Map with same keys, values transformed to frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords<K>(input: Map<K, Point>): Map<K, Point>;
  toViewportCoords(
    input: Point | Point[] | Record<string, Point> | Map<unknown, Point>
  ): Point | Point[] | Record<string, Point> | Map<unknown, Point> {
    if (!this.lastTransform) {
      throw new Error("Cannot call toViewportCoords before first render");
    }

    // Scale CSS pixel coordinates to buffer coordinates (accounts for DPR)
    const dpr = window.devicePixelRatio || 1;
    const scalePoint = ([x, y]: Point): Point => [x * dpr, y * dpr];

    if (Array.isArray(input)) {
      if (input.length === 2 && typeof input[0] === "number") {
        // Single point [x, y]
        return toViewportCoords(scalePoint(input as Point), this.lastTransform);
      }
      // Array of points
      const scaled = (input as Point[]).map(scalePoint);
      return toViewportCoords(scaled, this.lastTransform);
    }

    if (input instanceof Map) {
      const scaled = new Map<unknown, Point>();
      for (const [key, point] of input) {
        scaled.set(key, scalePoint(point));
      }
      return toViewportCoords(scaled, this.lastTransform);
    }

    // Record
    const scaled: Record<string, Point> = {};
    for (const [key, point] of Object.entries(input)) {
      scaled[key] = scalePoint(point);
    }
    return toViewportCoords(scaled, this.lastTransform);
  }
}
