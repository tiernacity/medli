import type {
  Frame,
  Generator,
  RenderContext,
  Renderer,
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

  it("should allow implementing Renderer interface", () => {
    let lastTime = -1;
    let looping = false;

    const renderer: Renderer = {
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
});
