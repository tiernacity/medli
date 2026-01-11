/**
 * WebGPU Renderer for medli
 *
 * Transforms Frame spec IR into WebGPU render commands using TypeGPU.
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
import tgpu from "typegpu";
import { mat3 } from "gl-matrix";
import { memoize } from "es-toolkit";

/**
 * Metrics specific to WebGPU rendering.
 * WebGPU uses GPU-accelerated batch rendering with SDF shaders.
 */
export interface WebGPURendererMetrics extends BaseRendererMetrics {
  /**
   * GPU execution time from previous frame in milliseconds.
   * Uses timestamp queries (1-frame delayed).
   * undefined if timestamp queries unavailable or timing invalid.
   */
  gpuTime: number | undefined;
  /** Number of instanced draw calls issued this frame */
  batchCount: number;
  /** Whether GPU timestamp queries are available */
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

  // Clear canvas before parsing to prevent color blending from previous parses
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;

  return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
}

const parseColor = memoize(parseColorImpl);

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
  position: [number, number]; // Top-left corner (in Y-up frame coords)
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

/** WebGPU texture with dimension metadata */
interface TextureWithDimensions {
  texture: GPUTexture;
  width: number;
  height: number;
}

// ============================================================================
// WGSL Shaders as Raw Strings
// ============================================================================

const RECT_SHADER = /* wgsl */ `
struct Uniforms {
  viewportTransform: mat3x3f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) transform_col0: vec3f,
  @location(2) transform_col1: vec3f,
  @location(3) transform_col2: vec3f,
  @location(4) fillColor: vec4f,
  @location(5) strokeColor: vec4f,
  @location(6) strokeWidth: f32,
  @location(7) size: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localPos: vec2f,
  @location(1) fillColor: vec4f,
  @location(2) strokeColor: vec4f,
  @location(3) strokeWidth: f32,
  @location(4) size: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldTransform = mat3x3f(
    input.transform_col0,
    input.transform_col1,
    input.transform_col2
  );

  // Scale quad by size + stroke
  let quadSize = input.size + vec2f(input.strokeWidth);
  let localPos = input.position * quadSize;

  output.localPos = localPos;
  output.fillColor = input.fillColor;
  output.strokeColor = input.strokeColor;
  output.strokeWidth = input.strokeWidth;
  output.size = input.size;

  let worldPos = worldTransform * vec3f(localPos, 1.0);
  let clipPos = uniforms.viewportTransform * worldPos;
  output.position = vec4f(clipPos.xy, 0.0, 1.0);

  return output;
}

// Box SDF with Chebyshev distance for sharp corners
fn sdBox(p: vec2f, b: vec2f) -> f32 {
  let d = abs(p) - b;
  return max(d.x, d.y);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let halfSize = input.size * 0.5;
  let d = sdBox(input.localPos, halfSize);
  let aa = fwidth(d);

  // Fill
  let fillAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Stroke
  let halfStroke = input.strokeWidth * 0.5;
  let strokeOuter = d - halfStroke;
  let strokeInner = d + halfStroke;
  let strokeAlpha = (1.0 - smoothstep(-aa, aa, strokeOuter)) * smoothstep(-aa, aa, strokeInner);

  // Premultiply and composite
  let fillResult = vec4f(input.fillColor.rgb * input.fillColor.a, input.fillColor.a) * fillAlpha;
  let strokeResult = vec4f(input.strokeColor.rgb * input.strokeColor.a, input.strokeColor.a) * strokeAlpha;

  let result = fillResult * (1.0 - strokeResult.a) + strokeResult;
  if (result.a < 0.001) { discard; }
  return result;
}
`;

const CIRCLE_SHADER = /* wgsl */ `
struct Uniforms {
  viewportTransform: mat3x3f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) transform_col0: vec3f,
  @location(2) transform_col1: vec3f,
  @location(3) transform_col2: vec3f,
  @location(4) fillColor: vec4f,
  @location(5) strokeColor: vec4f,
  @location(6) strokeWidth: f32,
  @location(7) radius: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localPos: vec2f,
  @location(1) fillColor: vec4f,
  @location(2) strokeColor: vec4f,
  @location(3) strokeWidth: f32,
  @location(4) radius: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldTransform = mat3x3f(
    input.transform_col0,
    input.transform_col1,
    input.transform_col2
  );

  // Scale quad to contain circle plus stroke
  let quadSize = (input.radius + input.strokeWidth) * 2.0;
  let localPos = input.position * quadSize;

  output.localPos = localPos;
  output.fillColor = input.fillColor;
  output.strokeColor = input.strokeColor;
  output.strokeWidth = input.strokeWidth;
  output.radius = input.radius;

  let worldPos = worldTransform * vec3f(localPos, 1.0);
  let clipPos = uniforms.viewportTransform * worldPos;
  output.position = vec4f(clipPos.xy, 0.0, 1.0);

  return output;
}

// Circle SDF
fn sdCircle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let d = sdCircle(input.localPos, input.radius);
  let aa = fwidth(d);

  // Fill
  let fillAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Stroke
  let halfStroke = input.strokeWidth * 0.5;
  let strokeOuter = d - halfStroke;
  let strokeInner = d + halfStroke;
  let strokeAlpha = (1.0 - smoothstep(-aa, aa, strokeOuter)) * smoothstep(-aa, aa, strokeInner);

  // Premultiply and composite
  let fillResult = vec4f(input.fillColor.rgb * input.fillColor.a, input.fillColor.a) * fillAlpha;
  let strokeResult = vec4f(input.strokeColor.rgb * input.strokeColor.a, input.strokeColor.a) * strokeAlpha;

  let result = fillResult * (1.0 - strokeResult.a) + strokeResult;
  if (result.a < 0.001) { discard; }
  return result;
}
`;

const LINE_SHADER = /* wgsl */ `
struct Uniforms {
  viewportTransform: mat3x3f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) transform_col0: vec3f,
  @location(2) transform_col1: vec3f,
  @location(3) transform_col2: vec3f,
  @location(4) strokeColor: vec4f,
  @location(5) strokeWidth: f32,
  @location(6) startPoint: vec2f,
  @location(7) endPoint: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localPos: vec2f,
  @location(1) strokeColor: vec4f,
  @location(2) strokeWidth: f32,
  @location(3) startPoint: vec2f,
  @location(4) endPoint: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldTransform = mat3x3f(
    input.transform_col0,
    input.transform_col1,
    input.transform_col2
  );

  // Calculate line direction and perpendicular
  let lineDir = input.endPoint - input.startPoint;
  let lineLen = length(lineDir);

  // Handle degenerate case (zero-length line)
  if (lineLen < 0.0001) {
    output.position = vec4f(0.0, 0.0, 0.0, 1.0);
    output.localPos = vec2f(0.0, 0.0);
    output.strokeColor = input.strokeColor;
    output.strokeWidth = input.strokeWidth;
    output.startPoint = input.startPoint;
    output.endPoint = input.endPoint;
    return output;
  }

  let dir = lineDir / lineLen;
  let perp = vec2f(-dir.y, dir.x);

  let halfWidth = input.strokeWidth * 0.5;

  // Map from [-0.5, 0.5] to line coordinates with padding for caps
  let alongLine = (input.position.x + 0.5) * (lineLen + input.strokeWidth) - halfWidth;
  let perpOffset = input.position.y * input.strokeWidth;

  let localPos = input.startPoint + dir * alongLine + perp * perpOffset;
  output.localPos = localPos;

  output.startPoint = input.startPoint;
  output.endPoint = input.endPoint;
  output.strokeColor = input.strokeColor;
  output.strokeWidth = input.strokeWidth;

  let worldPos = worldTransform * vec3f(localPos, 1.0);
  let clipPos = uniforms.viewportTransform * worldPos;
  output.position = vec4f(clipPos.xy, 0.0, 1.0);

  return output;
}

// SDF for line segment with butt caps (box shape instead of capsule)
fn sdLineButt(p: vec2f, a: vec2f, b: vec2f, halfWidth: f32) -> f32 {
  let ba = b - a;
  let lineLen = length(ba);

  // Handle degenerate case (zero-length line)
  if (lineLen < 0.0001) {
    return length(p - a) - halfWidth;
  }

  let dir = ba / lineLen;
  let perp = vec2f(-dir.y, dir.x);
  let pa = p - a;

  // Project point onto line's local coordinate system
  let alongLine = dot(pa, dir);
  let perpDist = abs(dot(pa, perp));

  // Box distance: clamp to rectangle bounds [0, lineLen] x [-halfWidth, halfWidth]
  let dAlong = max(-alongLine, alongLine - lineLen);
  let dPerp = perpDist - halfWidth;

  // Standard 2D box SDF combination
  let d = vec2f(max(dAlong, 0.0), max(dPerp, 0.0));
  return length(d) + min(max(dAlong, dPerp), 0.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let halfWidth = input.strokeWidth * 0.5;
  let d = sdLineButt(input.localPos, input.startPoint, input.endPoint, halfWidth);
  let aa = fwidth(d);

  // Stroke alpha with anti-aliased edge
  let strokeAlpha = 1.0 - smoothstep(-aa, aa, d);

  // Premultiply
  let result = vec4f(input.strokeColor.rgb * input.strokeColor.a, input.strokeColor.a) * strokeAlpha;

  if (result.a < 0.001) { discard; }
  return result;
}
`;

const IMAGE_SHADER = /* wgsl */ `
struct Uniforms {
  viewportTransform: mat3x3f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) transform_col0: vec3f,
  @location(2) transform_col1: vec3f,
  @location(3) transform_col2: vec3f,
  @location(4) imagePosition: vec2f,
  @location(5) imageSize: vec2f,
  @location(6) uvRect: vec4f,  // x, y, width, height in UV space (0-1)
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var textureSampler: sampler;
@group(1) @binding(1) var textureData: texture_2d<f32>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldTransform = mat3x3f(
    input.transform_col0,
    input.transform_col1,
    input.transform_col2
  );

  // Map unit quad [0,1] to UV coords within crop rect
  output.uv = input.uvRect.xy + input.position * input.uvRect.zw;

  // Map unit quad to image position and size
  // Image extends from position to position + size
  let localPos = input.imagePosition + input.position * input.imageSize;

  let worldPos = worldTransform * vec3f(localPos, 1.0);
  let clipPos = uniforms.viewportTransform * worldPos;
  output.position = vec4f(clipPos.xy, 0.0, 1.0);

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Sample texture with Y-flip (texture coords are Y-up, but textures load Y-down)
  let flippedUV = vec2f(input.uv.x, 1.0 - input.uv.y);
  let color = textureSample(textureData, textureSampler, flippedUV);

  if (color.a < 0.001) { discard; }
  return color;
}
`;

const BLIT_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen triangle using vertex index
  // Vertex 0: (-1, -1), Vertex 1: (3, -1), Vertex 2: (-1, 3)
  var output: VertexOutput;
  let x = f32((vertexIndex & 1u) << 2u) - 1.0;
  let y = f32((vertexIndex & 2u) << 1u) - 1.0;
  output.position = vec4f(x, y, 0.0, 1.0);
  output.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}

@group(0) @binding(0) var blitSampler: sampler;
@group(0) @binding(1) var blitTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(blitTexture, blitSampler, input.uv);
}
`;

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
 * WebGPU Renderer for medli.
 *
 * Renders Frame spec IR using SDF-based primitives for resolution-independent
 * rendering with anti-aliased edges.
 *
 * Phase 1: Foundation - initialization, canvas configuration, background clearing
 */
export class WebGPURenderer extends BaseRenderer<WebGPURendererMetrics> {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private resizeObserver: ResizeObserver;
  private lastTransform: ViewportTransformResult | null = null;
  private resourceManager: ResourceManager<TextureWithDimensions>;
  private initialized = false;
  private initPromise: Promise<void>;

  // Render pipelines
  private rectPipeline: GPURenderPipeline | null = null;
  private circlePipeline: GPURenderPipeline | null = null;
  private linePipeline: GPURenderPipeline | null = null;
  private imagePipeline: GPURenderPipeline | null = null;

  // Shared resources
  private quadBuffer: GPUBuffer | null = null;
  private imageQuadBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroupLayout: GPUBindGroupLayout | null = null;
  private imageSampler: GPUSampler | null = null;
  private textureBindGroupLayout: GPUBindGroupLayout | null = null;

  // Blit pipeline for copying render target to swap chain
  private blitPipeline: GPURenderPipeline | null = null;
  private blitSampler: GPUSampler | null = null;
  private blitBindGroupLayout: GPUBindGroupLayout | null = null;

  // Buffers pending destruction after GPU work completes
  private pendingBufferDestruction: GPUBuffer[] = [];

  // Persistent render target for frame accumulation (when background is undefined)
  private renderTarget: GPUTexture | null = null;
  private renderTargetView: GPUTextureView | null = null;

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
      // WebGPU-specific
      gpuTime: undefined,
      batchCount: 0,
      gpuTimerAvailable: false,
    });

    this.canvas = element;

    // Initialize resource manager with WebGPU texture processing
    // Note: process() will only work after device is initialized
    this.resourceManager = new ResourceManager({
      process: async (blob: Blob): Promise<TextureWithDimensions> => {
        if (!this.device) {
          throw new Error("WebGPU device not initialized");
        }

        const imageBitmap = await createImageBitmap(blob);

        const texture = this.device.createTexture({
          size: [imageBitmap.width, imageBitmap.height],
          format: "rgba8unorm",
          usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.device.queue.copyExternalImageToTexture(
          { source: imageBitmap },
          { texture },
          [imageBitmap.width, imageBitmap.height]
        );

        const width = imageBitmap.width;
        const height = imageBitmap.height;
        imageBitmap.close();
        return { texture, width, height };
      },
      dispose: (resource: TextureWithDimensions): void => {
        resource.texture.destroy();
      },
    });

    // Start initialization (don't await - async init pattern)
    this.initPromise = this.init();

    // Sync buffer size with CSS size (accounting for DPR)
    this.syncBufferSize();
    this.resizeObserver = new ResizeObserver(() => this.syncBufferSize());
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Initialize WebGPU device and configure canvas context.
   */
  private async init(): Promise<void> {
    try {
      // Initialize TypeGPU root (handles adapter/device acquisition)
      const root = await tgpu.init();
      this.device = root.device;

      // Configure canvas context
      const context = this.canvas.getContext("webgpu");
      if (!context) {
        throw new Error("Could not get WebGPU context from canvas");
      }
      this.context = context;

      context.configure({
        device: this.device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: "premultiplied",
      });

      // Set up device loss handler
      this.device.lost.then((info) => {
        console.error(`WebGPU device lost: ${info.message}`);
        this.device = null;
        this.initialized = false;

        if (info.reason !== "destroyed") {
          // Transient loss - try to recover
          this.initPromise = this.init();
        }
      });

      // Create shared resources
      this.createQuadBuffer();
      this.createUniformBuffer();
      this.createPipelines();
      this.createBlitPipeline();

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize WebGPU:", error);
      throw error;
    }
  }

  /**
   * Create the unit quad vertex buffer for SDF shapes.
   * Quad from -0.5 to 0.5 (6 vertices, 2 triangles).
   */
  private createQuadBuffer(): void {
    if (!this.device) return;

    // Unit quad from -0.5 to 0.5 for SDF shapes
    const quadVertices = new Float32Array([
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ]);

    this.quadBuffer = this.device.createBuffer({
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(this.quadBuffer.getMappedRange()).set(quadVertices);
    this.quadBuffer.unmap();

    // Unit quad from 0 to 1 for image UV mapping
    const imageQuadVertices = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
    ]);

    this.imageQuadBuffer = this.device.createBuffer({
      size: imageQuadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(this.imageQuadBuffer.getMappedRange()).set(
      imageQuadVertices
    );
    this.imageQuadBuffer.unmap();

    // Create sampler for image textures
    this.imageSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  /**
   * Create the uniform buffer for viewport transform.
   * mat3x3f in WebGPU is 48 bytes (3 * vec4f alignment).
   */
  private createUniformBuffer(): void {
    if (!this.device) return;

    // mat3x3f requires 48 bytes (3 columns * 4 floats * 4 bytes, but aligned to vec4)
    // WGSL mat3x3f is stored as 3 vec4f (with padding)
    this.uniformBuffer = this.device.createBuffer({
      size: 48, // 3 columns * 16 bytes (vec4 alignment)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create uniform bind group layout
    this.uniformBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
  }

  /**
   * Create render pipelines for each shape type.
   */
  private createPipelines(): void {
    if (!this.device || !this.uniformBindGroupLayout) return;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.uniformBindGroupLayout],
    });

    // Blend state for premultiplied alpha
    const blendState: GPUBlendState = {
      color: {
        srcFactor: "one",
        dstFactor: "one-minus-src-alpha",
        operation: "add",
      },
      alpha: {
        srcFactor: "one",
        dstFactor: "one-minus-src-alpha",
        operation: "add",
      },
    };

    // Rectangle pipeline
    this.rectPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: RECT_SHADER }),
        entryPoint: "vertexMain",
        buffers: [
          // Quad vertices (per-vertex)
          {
            arrayStride: 2 * 4, // vec2f
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          // Instance data (per-instance)
          {
            arrayStride:
              9 * 4 + // mat3 (3 vec3f)
              4 * 4 + // fillColor vec4f
              4 * 4 + // strokeColor vec4f
              1 * 4 + // strokeWidth f32
              2 * 4, // size vec2f
            stepMode: "instance",
            attributes: [
              // mat3 columns
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
              { shaderLocation: 3, offset: 24, format: "float32x3" },
              // fillColor
              { shaderLocation: 4, offset: 36, format: "float32x4" },
              // strokeColor
              { shaderLocation: 5, offset: 52, format: "float32x4" },
              // strokeWidth
              { shaderLocation: 6, offset: 68, format: "float32" },
              // size
              { shaderLocation: 7, offset: 72, format: "float32x2" },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: RECT_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format: presentationFormat,
            blend: blendState,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Circle pipeline
    this.circlePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: CIRCLE_SHADER }),
        entryPoint: "vertexMain",
        buffers: [
          // Quad vertices (per-vertex)
          {
            arrayStride: 2 * 4,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          // Instance data (per-instance)
          {
            arrayStride:
              9 * 4 + // mat3 (3 vec3f)
              4 * 4 + // fillColor vec4f
              4 * 4 + // strokeColor vec4f
              1 * 4 + // strokeWidth f32
              1 * 4, // radius f32
            stepMode: "instance",
            attributes: [
              // mat3 columns
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
              { shaderLocation: 3, offset: 24, format: "float32x3" },
              // fillColor
              { shaderLocation: 4, offset: 36, format: "float32x4" },
              // strokeColor
              { shaderLocation: 5, offset: 52, format: "float32x4" },
              // strokeWidth
              { shaderLocation: 6, offset: 68, format: "float32" },
              // radius
              { shaderLocation: 7, offset: 72, format: "float32" },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: CIRCLE_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format: presentationFormat,
            blend: blendState,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Line pipeline
    this.linePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: LINE_SHADER }),
        entryPoint: "vertexMain",
        buffers: [
          // Quad vertices (per-vertex)
          {
            arrayStride: 2 * 4,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          // Instance data (per-instance)
          {
            arrayStride:
              9 * 4 + // mat3 (3 vec3f)
              4 * 4 + // strokeColor vec4f
              1 * 4 + // strokeWidth f32
              2 * 4 + // startPoint vec2f
              2 * 4, // endPoint vec2f
            stepMode: "instance",
            attributes: [
              // mat3 columns
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
              { shaderLocation: 3, offset: 24, format: "float32x3" },
              // strokeColor
              { shaderLocation: 4, offset: 36, format: "float32x4" },
              // strokeWidth
              { shaderLocation: 5, offset: 52, format: "float32" },
              // startPoint
              { shaderLocation: 6, offset: 56, format: "float32x2" },
              // endPoint
              { shaderLocation: 7, offset: 64, format: "float32x2" },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: LINE_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format: presentationFormat,
            blend: blendState,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Create texture bind group layout for image pipeline
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
      ],
    });

    // Image pipeline with two bind groups: uniforms (0) + texture/sampler (1)
    const imagePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.uniformBindGroupLayout,
        this.textureBindGroupLayout,
      ],
    });

    this.imagePipeline = this.device.createRenderPipeline({
      layout: imagePipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: IMAGE_SHADER }),
        entryPoint: "vertexMain",
        buffers: [
          // Quad vertices (per-vertex)
          {
            arrayStride: 2 * 4, // vec2f
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          // Instance data (per-instance)
          {
            arrayStride:
              9 * 4 + // mat3 (3 vec3f)
              2 * 4 + // imagePosition vec2f
              2 * 4 + // imageSize vec2f
              4 * 4, // uvRect vec4f
            stepMode: "instance",
            attributes: [
              // mat3 columns
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
              { shaderLocation: 3, offset: 24, format: "float32x3" },
              // imagePosition
              { shaderLocation: 4, offset: 36, format: "float32x2" },
              // imageSize
              { shaderLocation: 5, offset: 44, format: "float32x2" },
              // uvRect
              { shaderLocation: 6, offset: 52, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: IMAGE_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format: presentationFormat,
            blend: blendState,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  /**
   * Create the blit pipeline for copying render target to swap chain.
   * Uses a fullscreen triangle to avoid vertex buffer overhead.
   */
  private createBlitPipeline(): void {
    if (!this.device) return;

    const blitModule = this.device.createShaderModule({ code: BLIT_SHADER });

    this.blitBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
      ],
    });

    this.blitPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.blitBindGroupLayout],
      }),
      vertex: {
        module: blitModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: blitModule,
        entryPoint: "fragmentMain",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.blitSampler = this.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  /**
   * Ensure the persistent render target exists and matches the canvas size.
   * WebGPU swap chain textures don't preserve content between frames,
   * so we need a persistent render target for frame accumulation.
   */
  private ensureRenderTarget(): GPUTextureView {
    if (!this.device) throw new Error("Device not initialized");

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Recreate if size changed or doesn't exist
    if (
      !this.renderTarget ||
      this.renderTarget.width !== width ||
      this.renderTarget.height !== height
    ) {
      if (this.renderTarget) {
        this.renderTarget.destroy();
      }

      this.renderTarget = this.device.createTexture({
        size: [width, height],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC,
      });
      this.renderTargetView = this.renderTarget.createView();
    }

    return this.renderTargetView!;
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
    // Reset WebGPU-specific metrics for this frame
    this._metrics = { ...this._metrics, batchCount: 0 };

    // Wait for initialization if needed
    if (!this.initialized) {
      await this.initPromise;
    }

    // Check if device is available (may be lost)
    if (!this.device || !this.context) {
      console.warn("WebGPU device not available");
      this.endMetricsFrame();
      return;
    }

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

    // Compute viewport transform
    const vp = frame.viewport;
    const transform = computeViewportTransform(
      vp,
      this.canvas.width,
      this.canvas.height
    );
    this.lastTransform = transform;

    // Build viewport transform matrix for WebGPU (clip space is -1 to 1)
    const viewportMatrix = mat3.create();
    const scaleX = transform.scaleX / (this.canvas.width / 2);
    const scaleY = transform.scaleY / (this.canvas.height / 2);
    mat3.set(viewportMatrix, scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1);

    // Update uniform buffer with viewport matrix
    // WGSL mat3x3f is stored as 3 vec4f (columns with padding)
    const uniformData = new Float32Array(12); // 3 columns * 4 floats (vec4 padded)
    // Column 0
    uniformData[0] = viewportMatrix[0];
    uniformData[1] = viewportMatrix[1];
    uniformData[2] = viewportMatrix[2];
    uniformData[3] = 0; // padding
    // Column 1
    uniformData[4] = viewportMatrix[3];
    uniformData[5] = viewportMatrix[4];
    uniformData[6] = viewportMatrix[5];
    uniformData[7] = 0; // padding
    // Column 2
    uniformData[8] = viewportMatrix[6];
    uniformData[9] = viewportMatrix[7];
    uniformData[10] = viewportMatrix[8];
    uniformData[11] = 0; // padding
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniformData);

    // Collect shapes from frame tree in traversal order (timed)
    const traversalStart = performance.now();
    const orderedShapes: OrderedShape[] = [];
    this.traverseNode(frame.root, [frame.root], mat3.create(), orderedShapes);
    this.recordTraversalTime(performance.now() - traversalStart);

    // Begin render pass
    const renderStart = performance.now();

    const commandEncoder = this.device.createCommandEncoder();

    // Get persistent render target for frame accumulation
    // WebGPU swap chain textures don't preserve content between frames,
    // so we render to a persistent texture and copy to the canvas
    const renderTargetView = this.ensureRenderTarget();

    // Determine clear color from frame background
    let clearValue: GPUColor;
    if (frame.background !== undefined) {
      const bgColor = parseColor(frame.background);
      clearValue = {
        r: bgColor[0],
        g: bgColor[1],
        b: bgColor[2],
        a: bgColor[3],
      };
    } else {
      // Transparent clear when no background specified
      clearValue = { r: 0, g: 0, b: 0, a: 0 };
    }

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: renderTargetView,
          clearValue,
          loadOp: frame.background !== undefined ? "clear" : "load",
          storeOp: "store",
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Render shapes in tree order with smart batching
    const batchCount = this.renderOrderedShapes(
      passEncoder,
      orderedShapes,
      resourceMap
    );

    passEncoder.end();

    // Blit render target to canvas swap chain texture
    const canvasTexture = this.context.getCurrentTexture();
    const blitBindGroup = this.device.createBindGroup({
      layout: this.blitBindGroupLayout!,
      entries: [
        { binding: 0, resource: this.blitSampler! },
        { binding: 1, resource: this.renderTargetView! },
      ],
    });

    const blitPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasTexture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    blitPass.setPipeline(this.blitPipeline!);
    blitPass.setBindGroup(0, blitBindGroup);
    blitPass.draw(3); // Fullscreen triangle
    blitPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    // Schedule buffer destruction after GPU work completes
    const buffersToDestroy = this.pendingBufferDestruction;
    this.pendingBufferDestruction = [];
    this.device.queue.onSubmittedWorkDone().then(() => {
      for (const buffer of buffersToDestroy) {
        buffer.destroy();
      }
    });

    this.recordRenderTime(performance.now() - renderStart);

    // Record shape and batch counts
    this.recordShapeCount(orderedShapes.length);
    this._metrics = { ...this._metrics, batchCount };

    // Finalize metrics
    this.endMetricsFrame();
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
   * @returns The number of batches (draw calls) issued
   */
  private renderOrderedShapes(
    passEncoder: GPURenderPassEncoder,
    shapes: OrderedShape[],
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
          passEncoder,
          batch,
          currentType,
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
    passEncoder: GPURenderPassEncoder,
    batch: OrderedShape[],
    type: OrderedShape["type"],
    resourceMap: Map<string, TextureWithDimensions>
  ): number {
    switch (type) {
      case "rectangle": {
        const instances = batch.map(
          (s) => (s as { type: "rectangle"; instance: RectInstance }).instance
        );
        this.renderRectangles(passEncoder, instances);
        return 1; // Single instanced draw call
      }
      case "circle": {
        const instances = batch.map(
          (s) => (s as { type: "circle"; instance: CircleInstance }).instance
        );
        this.renderCircles(passEncoder, instances);
        return 1; // Single instanced draw call
      }
      case "line": {
        const instances = batch.map(
          (s) => (s as { type: "line"; instance: LineInstance }).instance
        );
        this.renderLines(passEncoder, instances);
        return 1; // Single instanced draw call
      }
      case "image": {
        const instances = batch.map(
          (s) => (s as { type: "image"; instance: ImageInstance }).instance
        );
        return this.renderImages(passEncoder, instances, resourceMap);
      }
    }
  }

  /**
   * Render all rectangles using instanced drawing.
   */
  private renderRectangles(
    passEncoder: GPURenderPassEncoder,
    instances: RectInstance[]
  ): void {
    if (
      instances.length === 0 ||
      !this.device ||
      !this.rectPipeline ||
      !this.quadBuffer ||
      !this.uniformBuffer ||
      !this.uniformBindGroupLayout
    )
      return;

    // Create instance data buffer
    // Layout: mat3 (9 floats) + fillColor (4) + strokeColor (4) + strokeWidth (1) + size (2) = 20 floats
    const instanceStride = 20;
    const instanceData = new Float32Array(instances.length * instanceStride);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const offset = i * instanceStride;

      // mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        instanceData[offset + j] = inst.worldTransform[j];
      }
      // fillColor (4 floats)
      instanceData[offset + 9] = inst.fillColor[0];
      instanceData[offset + 10] = inst.fillColor[1];
      instanceData[offset + 11] = inst.fillColor[2];
      instanceData[offset + 12] = inst.fillColor[3];
      // strokeColor (4 floats)
      instanceData[offset + 13] = inst.strokeColor[0];
      instanceData[offset + 14] = inst.strokeColor[1];
      instanceData[offset + 15] = inst.strokeColor[2];
      instanceData[offset + 16] = inst.strokeColor[3];
      // strokeWidth (1 float)
      instanceData[offset + 17] = inst.strokeWidth;
      // size (2 floats)
      instanceData[offset + 18] = inst.size[0];
      instanceData[offset + 19] = inst.size[1];
    }

    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    // Set up pipeline and draw
    passEncoder.setPipeline(this.rectPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.quadBuffer);
    passEncoder.setVertexBuffer(1, instanceBuffer);
    passEncoder.draw(6, instances.length);

    // Queue buffer for destruction after GPU work completes
    this.pendingBufferDestruction.push(instanceBuffer);
  }

  /**
   * Render all circles using instanced drawing.
   */
  private renderCircles(
    passEncoder: GPURenderPassEncoder,
    instances: CircleInstance[]
  ): void {
    if (
      instances.length === 0 ||
      !this.device ||
      !this.circlePipeline ||
      !this.quadBuffer ||
      !this.uniformBuffer ||
      !this.uniformBindGroupLayout
    )
      return;

    // Create instance data buffer
    // Layout: mat3 (9 floats) + fillColor (4) + strokeColor (4) + strokeWidth (1) + radius (1) = 19 floats
    const instanceStride = 19;
    const instanceData = new Float32Array(instances.length * instanceStride);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const offset = i * instanceStride;

      // mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        instanceData[offset + j] = inst.worldTransform[j];
      }
      // fillColor (4 floats)
      instanceData[offset + 9] = inst.fillColor[0];
      instanceData[offset + 10] = inst.fillColor[1];
      instanceData[offset + 11] = inst.fillColor[2];
      instanceData[offset + 12] = inst.fillColor[3];
      // strokeColor (4 floats)
      instanceData[offset + 13] = inst.strokeColor[0];
      instanceData[offset + 14] = inst.strokeColor[1];
      instanceData[offset + 15] = inst.strokeColor[2];
      instanceData[offset + 16] = inst.strokeColor[3];
      // strokeWidth (1 float)
      instanceData[offset + 17] = inst.strokeWidth;
      // radius (1 float)
      instanceData[offset + 18] = inst.radius;
    }

    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    // Set up pipeline and draw
    passEncoder.setPipeline(this.circlePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.quadBuffer);
    passEncoder.setVertexBuffer(1, instanceBuffer);
    passEncoder.draw(6, instances.length);

    // Queue buffer for destruction after GPU work completes
    this.pendingBufferDestruction.push(instanceBuffer);
  }

  /**
   * Render all lines using instanced drawing.
   */
  private renderLines(
    passEncoder: GPURenderPassEncoder,
    instances: LineInstance[]
  ): void {
    if (
      instances.length === 0 ||
      !this.device ||
      !this.linePipeline ||
      !this.quadBuffer ||
      !this.uniformBuffer ||
      !this.uniformBindGroupLayout
    )
      return;

    // Create instance data buffer
    // Layout: mat3 (9 floats) + strokeColor (4) + strokeWidth (1) + startPoint (2) + endPoint (2) = 18 floats
    const instanceStride = 18;
    const instanceData = new Float32Array(instances.length * instanceStride);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const offset = i * instanceStride;

      // mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        instanceData[offset + j] = inst.worldTransform[j];
      }
      // strokeColor (4 floats)
      instanceData[offset + 9] = inst.strokeColor[0];
      instanceData[offset + 10] = inst.strokeColor[1];
      instanceData[offset + 11] = inst.strokeColor[2];
      instanceData[offset + 12] = inst.strokeColor[3];
      // strokeWidth (1 float)
      instanceData[offset + 13] = inst.strokeWidth;
      // startPoint (2 floats)
      instanceData[offset + 14] = inst.startPoint[0];
      instanceData[offset + 15] = inst.startPoint[1];
      // endPoint (2 floats)
      instanceData[offset + 16] = inst.endPoint[0];
      instanceData[offset + 17] = inst.endPoint[1];
    }

    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    // Set up pipeline and draw
    passEncoder.setPipeline(this.linePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.quadBuffer);
    passEncoder.setVertexBuffer(1, instanceBuffer);
    passEncoder.draw(6, instances.length);

    // Queue buffer for destruction after GPU work completes
    this.pendingBufferDestruction.push(instanceBuffer);
  }

  /**
   * Render all images.
   * Images are rendered one at a time since each may have a different texture.
   * @returns The number of draw calls issued
   */
  private renderImages(
    passEncoder: GPURenderPassEncoder,
    instances: ImageInstance[],
    resourceMap: Map<string, TextureWithDimensions>
  ): number {
    if (
      instances.length === 0 ||
      !this.device ||
      !this.imagePipeline ||
      !this.imageQuadBuffer ||
      !this.uniformBuffer ||
      !this.uniformBindGroupLayout ||
      !this.textureBindGroupLayout ||
      !this.imageSampler
    )
      return 0;

    // Create uniform bind group (shared across all images)
    const uniformBindGroup = this.device.createBindGroup({
      layout: this.uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    let drawCount = 0;

    // Render each image (one draw call per image since each has different texture)
    for (const inst of instances) {
      const resource = resourceMap.get(inst.url);
      if (!resource) continue; // Skip if texture not loaded

      // Calculate UV rect from crop pixels using texture dimensions
      let uvRect: [number, number, number, number];
      if (inst.cropPixels) {
        // Convert pixel coordinates to UV (0-1) range
        const [cx, cy, cw, ch] = inst.cropPixels;
        uvRect = [
          cx / resource.width,
          cy / resource.height,
          cw / resource.width,
          ch / resource.height,
        ];
      } else {
        // Full texture
        uvRect = [0, 0, 1, 1];
      }

      // Create texture bind group for this image
      const textureBindGroup = this.device.createBindGroup({
        layout: this.textureBindGroupLayout,
        entries: [
          { binding: 0, resource: this.imageSampler },
          { binding: 1, resource: resource.texture.createView() },
        ],
      });

      // Create instance data buffer for single image
      // Layout: mat3 (9 floats) + imagePosition (2) + imageSize (2) + uvRect (4) = 17 floats
      const instanceStride = 17;
      const instanceData = new Float32Array(instanceStride);

      // mat3 (9 floats)
      for (let j = 0; j < 9; j++) {
        instanceData[j] = inst.worldTransform[j];
      }
      // imagePosition (2 floats)
      instanceData[9] = inst.position[0];
      instanceData[10] = inst.position[1];
      // imageSize (2 floats)
      instanceData[11] = inst.size[0];
      instanceData[12] = inst.size[1];
      // uvRect (4 floats)
      instanceData[13] = uvRect[0];
      instanceData[14] = uvRect[1];
      instanceData[15] = uvRect[2];
      instanceData[16] = uvRect[3];

      const instanceBuffer = this.device.createBuffer({
        size: instanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(instanceBuffer, 0, instanceData);

      // Set up pipeline and draw
      passEncoder.setPipeline(this.imagePipeline);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.setBindGroup(1, textureBindGroup);
      passEncoder.setVertexBuffer(0, this.imageQuadBuffer);
      passEncoder.setVertexBuffer(1, instanceBuffer);
      passEncoder.draw(6, 1);

      // Queue buffer for destruction after GPU work completes
      this.pendingBufferDestruction.push(instanceBuffer);
      drawCount++;
    }

    return drawCount;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();

    // Destroy any pending buffers
    for (const buffer of this.pendingBufferDestruction) {
      buffer.destroy();
    }
    this.pendingBufferDestruction = [];

    // Clean up texture resources
    this.resourceManager.destroy();

    // Clean up GPU buffers
    if (this.quadBuffer) {
      this.quadBuffer.destroy();
      this.quadBuffer = null;
    }
    if (this.imageQuadBuffer) {
      this.imageQuadBuffer.destroy();
      this.imageQuadBuffer = null;
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }

    // Clean up persistent render target
    if (this.renderTarget) {
      this.renderTarget.destroy();
      this.renderTarget = null;
      this.renderTargetView = null;
    }

    // Pipelines and bind group layouts are cleaned up by device destruction
    this.rectPipeline = null;
    this.circlePipeline = null;
    this.linePipeline = null;
    this.imagePipeline = null;
    this.blitPipeline = null;
    this.uniformBindGroupLayout = null;
    this.textureBindGroupLayout = null;
    this.blitBindGroupLayout = null;
    this.imageSampler = null;
    this.blitSampler = null;

    // WebGPU device is managed by TypeGPU - we don't explicitly destroy it
    // Setting to null allows garbage collection
    this.device = null;
    this.context = null;
    this.initialized = false;
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

// Re-export for convenience
export { expandMatrix, parseColor };
