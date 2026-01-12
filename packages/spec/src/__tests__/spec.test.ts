import type {
  BaseRendererMetrics,
  Frame,
  Generator,
  RenderContext,
  Renderer,
  RendererMetrics,
  RootMaterial,
} from "../index";
import { validateFrame } from "../index";

describe("spec types", () => {
  it("should allow creating a frame", () => {
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: "#000000",
      stroke: "#000000",
      strokeWidth: 1,
      children: [],
    };
    const frame: Frame = {
      background: "#ff0000",
      viewport: {
        halfWidth: 50,
        halfHeight: 50,
        scaleMode: "fit" as const,
      },
      root,
    };
    expect(frame.background).toBe("#ff0000");
    expect(frame.root.id).toBe("root");
  });

  it("should allow implementing Generator interface", () => {
    const generator: Generator = {
      frame: (context: RenderContext) => ({
        background: `hsl(${context.time}, 50%, 50%)`,
        viewport: {
          halfWidth: 50,
          halfHeight: 50,
          scaleMode: "fit" as const,
        },
        root: {
          type: "material",
          id: "root",
          fill: "#000000",
          stroke: "#000000",
          strokeWidth: 1,
          children: [],
        },
      }),
    };
    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });
    expect(frame.background).toBe("hsl(0, 50%, 50%)");
    expect(frame.root.type).toBe("material");
  });

  it("should allow implementing Renderer interface with BaseRendererMetrics", () => {
    let lastTime = -1;
    let looping = false;

    // Using the default generic parameter (BaseRendererMetrics)
    const renderer: Renderer = {
      metrics: {
        frameTime: 0,
        generatorTime: 0,
        traversalTime: 0,
        resourceTime: 0,
        renderTime: 0,
        frameCount: 0,
        fps: undefined,
        shapeCount: 0,
        lastFrameTimestamp: 0,
      },
      render: async (time = 0) => {
        lastTime = time;
      },
      loop: () => {
        looping = true;
      },
      stop: () => {
        looping = false;
      },
      destroy: () => {
        // cleanup
      },
    };

    renderer.render(42);
    expect(lastTime).toBe(42);

    renderer.loop();
    expect(looping).toBe(true);

    renderer.stop();
    expect(looping).toBe(false);
  });

  it("should allow implementing Renderer with deprecated RendererMetrics", () => {
    // Backwards compatibility: RendererMetrics includes gpuTime and batchCount
    const renderer: Renderer<RendererMetrics> = {
      metrics: {
        frameTime: 0,
        generatorTime: 0,
        traversalTime: 0,
        resourceTime: 0,
        renderTime: 0,
        gpuTime: undefined,
        frameCount: 0,
        fps: undefined,
        shapeCount: 0,
        batchCount: 0,
        lastFrameTimestamp: 0,
      },
      render: async () => {},
      loop: () => {},
      stop: () => {},
      destroy: () => {},
    };

    expect(renderer.metrics.gpuTime).toBeUndefined();
    expect(renderer.metrics.batchCount).toBe(0);
  });

  it("should allow implementing Renderer with custom metrics", () => {
    // Custom metrics extending BaseRendererMetrics
    interface CustomGPUMetrics extends BaseRendererMetrics {
      gpuTime: number | undefined;
      batchCount: number;
      textureUploads: number;
    }

    const renderer: Renderer<CustomGPUMetrics> = {
      metrics: {
        frameTime: 0,
        generatorTime: 0,
        traversalTime: 0,
        resourceTime: 0,
        renderTime: 0,
        frameCount: 0,
        fps: undefined,
        shapeCount: 0,
        lastFrameTimestamp: 0,
        gpuTime: 1.5,
        batchCount: 3,
        textureUploads: 2,
      },
      render: async () => {},
      loop: () => {},
      stop: () => {},
      destroy: () => {},
    };

    expect(renderer.metrics.gpuTime).toBe(1.5);
    expect(renderer.metrics.batchCount).toBe(3);
    expect(renderer.metrics.textureUploads).toBe(2);
  });
});

describe("validateFrame", () => {
  // Helper to create a valid frame for modification
  function createValidFrame(): Frame {
    return {
      viewport: {
        halfWidth: 100,
        halfHeight: 100,
        scaleMode: "fit",
      },
      root: {
        type: "material",
        id: "root",
        fill: "#000000",
        stroke: "#ffffff",
        strokeWidth: 1,
        children: [],
      },
    };
  }

  describe("valid frames", () => {
    it("should pass validation for a valid frame", () => {
      const frame = createValidFrame();
      const result = validateFrame(frame);
      expect(result).toEqual({ valid: true });
    });

    it("should pass validation for a frame with nested materials and transforms", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "child1",
          ref: "root",
          fill: "#ff0000",
          children: [
            {
              type: "transform",
              matrix: [1, 0, 0, 1, 10, 20],
              children: [
                {
                  type: "circle",
                  center: { x: 0, y: 0 },
                  radius: 10,
                },
              ],
            },
          ],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({ valid: true });
    });

    it("should pass validation for a frame with an image", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({ valid: true });
    });

    it("should pass validation for a frame with an image with valid crop", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({ valid: true });
    });
  });

  describe("viewport validation", () => {
    it("should fail for missing viewport", () => {
      const frame = createValidFrame();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (frame as any).viewport;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Frame missing required property: viewport",
      });
    });

    it("should fail for viewport.halfWidth = 0", () => {
      const frame = createValidFrame();
      frame.viewport.halfWidth = 0;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfWidth must be a positive finite number",
      });
    });

    it("should fail for viewport.halfWidth negative", () => {
      const frame = createValidFrame();
      frame.viewport.halfWidth = -10;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfWidth must be a positive finite number",
      });
    });

    it("should fail for viewport.halfWidth = NaN", () => {
      const frame = createValidFrame();
      frame.viewport.halfWidth = NaN;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfWidth must be a positive finite number",
      });
    });

    it("should fail for viewport.halfWidth = Infinity", () => {
      const frame = createValidFrame();
      frame.viewport.halfWidth = Infinity;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfWidth must be a positive finite number",
      });
    });

    it("should fail for viewport.halfHeight = 0", () => {
      const frame = createValidFrame();
      frame.viewport.halfHeight = 0;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfHeight must be a positive finite number",
      });
    });

    it("should fail for viewport.halfHeight negative", () => {
      const frame = createValidFrame();
      frame.viewport.halfHeight = -10;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfHeight must be a positive finite number",
      });
    });

    it("should fail for viewport.halfHeight = NaN", () => {
      const frame = createValidFrame();
      frame.viewport.halfHeight = NaN;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfHeight must be a positive finite number",
      });
    });

    it("should fail for viewport.halfHeight = Infinity", () => {
      const frame = createValidFrame();
      frame.viewport.halfHeight = Infinity;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport halfHeight must be a positive finite number",
      });
    });

    it("should fail for invalid viewport.scaleMode", () => {
      const frame = createValidFrame();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      frame.viewport.scaleMode = "invalid" as any;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Viewport scaleMode must be 'fit', 'fill', or 'stretch'",
      });
    });
  });

  describe("root material validation", () => {
    it("should fail for missing root fill", () => {
      const frame = createValidFrame();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (frame.root as any).fill;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Root material missing required property: fill",
      });
    });

    it("should fail for missing root stroke", () => {
      const frame = createValidFrame();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (frame.root as any).stroke;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Root material missing required property: stroke",
      });
    });

    it("should fail for missing root strokeWidth", () => {
      const frame = createValidFrame();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (frame.root as any).strokeWidth;
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Root material missing required property: strokeWidth",
      });
    });
  });

  describe("material ID validation", () => {
    it("should fail for duplicate material ID", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "duplicate",
          ref: "root",
          children: [],
        },
        {
          type: "material",
          id: "duplicate",
          ref: "root",
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Duplicate material ID: duplicate",
      });
    });

    it("should fail for duplicate material ID in nested structure", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "child1",
          ref: "root",
          children: [
            {
              type: "material",
              id: "child1",
              ref: "root",
              children: [],
            },
          ],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Duplicate material ID: child1",
      });
    });
  });

  describe("material ref validation", () => {
    it("should fail for material ref pointing to non-ancestor", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "child1",
          ref: "nonexistent",
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: 'Material "child1" references non-ancestor: "nonexistent"',
      });
    });

    it("should fail for material ref pointing to sibling", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "sibling1",
          ref: "root",
          children: [],
        },
        {
          type: "material",
          id: "sibling2",
          ref: "sibling1",
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: 'Material "sibling2" references non-ancestor: "sibling1"',
      });
    });

    it("should fail for material ref pointing to descendant", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "parent",
          ref: "root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "root",
              children: [],
            },
          ],
        },
        {
          type: "material",
          id: "other",
          ref: "child",
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: 'Material "other" references non-ancestor: "child"',
      });
    });
  });

  describe("transform matrix validation", () => {
    it("should fail for transform matrix with wrong length (too few)", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "transform",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matrix: [1, 0, 0, 1, 0] as any,
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix must have exactly 6 values, got 5",
      });
    });

    it("should fail for transform matrix with wrong length (too many)", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "transform",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matrix: [1, 0, 0, 1, 0, 0, 0] as any,
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix must have exactly 6 values, got 7",
      });
    });

    it("should fail for transform matrix with NaN value", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "transform",
          matrix: [1, 0, NaN, 1, 0, 0],
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix[2] must be a finite number",
      });
    });

    it("should fail for transform matrix with Infinity value", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "transform",
          matrix: [1, 0, 0, 1, Infinity, 0],
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix[4] must be a finite number",
      });
    });

    it("should fail for transform matrix with -Infinity value", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "transform",
          matrix: [1, 0, 0, 1, 0, -Infinity],
          children: [],
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix[5] must be a finite number",
      });
    });
  });

  describe("image validation", () => {
    it("should fail for image with empty URL", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image url must be a non-empty string",
      });
    });

    it("should fail for image with width = 0", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 0,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image width must be a positive finite number",
      });
    });

    it("should fail for image with negative width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: -50,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image width must be a positive finite number",
      });
    });

    it("should fail for image with NaN width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: NaN,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image width must be a positive finite number",
      });
    });

    it("should fail for image with Infinity width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: Infinity,
          height: 100,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image width must be a positive finite number",
      });
    });

    it("should fail for image with height = 0", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 0,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image height must be a positive finite number",
      });
    });

    it("should fail for image with negative height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: -50,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image height must be a positive finite number",
      });
    });

    it("should fail for image with NaN height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: NaN,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image height must be a positive finite number",
      });
    });

    it("should fail for image with Infinity height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: Infinity,
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image height must be a positive finite number",
      });
    });
  });

  describe("image crop validation", () => {
    it("should fail for image with negative crop.x", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: -1, y: 0, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.x must be a non-negative finite number",
      });
    });

    it("should fail for image with NaN crop.x", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: NaN, y: 0, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.x must be a non-negative finite number",
      });
    });

    it("should fail for image with Infinity crop.x", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: Infinity, y: 0, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.x must be a non-negative finite number",
      });
    });

    it("should fail for image with negative crop.y", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: -1, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.y must be a non-negative finite number",
      });
    });

    it("should fail for image with NaN crop.y", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: NaN, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.y must be a non-negative finite number",
      });
    });

    it("should fail for image with Infinity crop.y", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: Infinity, width: 50, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.y must be a non-negative finite number",
      });
    });

    it("should fail for image with crop.width = 0", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 0, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.width must be a positive finite number",
      });
    });

    it("should fail for image with negative crop.width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: -10, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.width must be a positive finite number",
      });
    });

    it("should fail for image with NaN crop.width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: NaN, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.width must be a positive finite number",
      });
    });

    it("should fail for image with Infinity crop.width", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: Infinity, height: 50 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.width must be a positive finite number",
      });
    });

    it("should fail for image with crop.height = 0", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 50, height: 0 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.height must be a positive finite number",
      });
    });

    it("should fail for image with negative crop.height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 50, height: -10 },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.height must be a positive finite number",
      });
    });

    it("should fail for image with NaN crop.height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 50, height: NaN },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.height must be a positive finite number",
      });
    });

    it("should fail for image with Infinity crop.height", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          crop: { x: 0, y: 0, width: 50, height: Infinity },
        },
      ];
      const result = validateFrame(frame);
      expect(result).toEqual({
        valid: false,
        error: "Image crop.height must be a positive finite number",
      });
    });
  });
});
