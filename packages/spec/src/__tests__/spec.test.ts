import type {
  BaseRendererMetrics,
  Frame,
  Generator,
  RenderContext,
  Renderer,
  RendererMetrics,
  RootMaterial,
} from "../index";

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
