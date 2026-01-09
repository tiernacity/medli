/**
 * @jest-environment jsdom
 */
import { CanvasRenderer } from "../index";
import type { Generator } from "@medli/spec";

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

describe("CanvasRenderer", () => {
  let mockContext: CanvasRenderingContext2D;
  let mockElement: HTMLCanvasElement;
  let mockGenerator: Generator;

  beforeEach(() => {
    mockContext = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      fillStyle: "",
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
    } as unknown as CanvasRenderingContext2D;

    // Mock canvas element with pre-set dimensions (renderer queries these)
    mockElement = {
      width: 100,
      height: 100,
      getContext: jest.fn().mockReturnValue(mockContext),
      getBoundingClientRect: jest.fn().mockReturnValue({
        width: 100,
        height: 100,
      }),
    } as unknown as HTMLCanvasElement;

    mockGenerator = {
      frame: jest.fn().mockReturnValue({
        background: "#ff0000",
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
  });

  it("should sync canvas buffer size with CSS size on construction", () => {
    // Set initial dimensions different from CSS size
    mockElement.width = 200;
    mockElement.height = 150;

    // getBoundingClientRect returns CSS size (100x100 from mock)
    new CanvasRenderer(mockElement, mockGenerator);

    // Renderer should sync buffer to CSS size (DPR=1 in test environment)
    expect(mockElement.width).toBe(100);
    expect(mockElement.height).toBe(100);
  });

  it("should throw if canvas context is not available", () => {
    mockElement.getContext = jest.fn().mockReturnValue(null);

    expect(() => new CanvasRenderer(mockElement, mockGenerator)).toThrow(
      "Could not get 2d context from canvas"
    );
  });

  it("should render the background color from the generator", async () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
    // Background is drawn in viewport coordinates after transform
    // With viewport halfWidth=50, halfHeight=50, it draws at (-50, -50) with size 100x100
    expect(mockContext.fillStyle).toBe("#ff0000");
    expect(mockContext.fillRect).toHaveBeenCalledWith(-50, -50, 100, 100);
  });

  it("should apply viewport transform before rendering", async () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    // Should save state, apply transform, then restore
    expect(mockContext.save).toHaveBeenCalled();
    expect(mockContext.translate).toHaveBeenCalledWith(50, 50); // Center of 100x100 element
    expect(mockContext.scale).toHaveBeenCalledWith(1, -1); // 1:1 scale with Y-flip
    expect(mockContext.restore).toHaveBeenCalled();
  });

  it("should clear the canvas when background is defined", async () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("should NOT clear the canvas when background is undefined", async () => {
    // Override generator to return frame without background
    mockGenerator.frame = jest.fn().mockReturnValue({
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
    });

    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockContext.clearRect).not.toHaveBeenCalled();
    // Also should not fill background
    expect(mockContext.fillRect).not.toHaveBeenCalled();
  });

  it("should default time to zero", async () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    await renderer.render();

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
  });
});
