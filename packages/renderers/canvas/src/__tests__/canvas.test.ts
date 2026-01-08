/**
 * @jest-environment jsdom
 */
import { CanvasRenderer } from "../index";
import type { Generator } from "@medli/spec";

describe("CanvasRenderer", () => {
  let mockContext: CanvasRenderingContext2D;
  let mockElement: HTMLCanvasElement;
  let mockGenerator: Generator;

  beforeEach(() => {
    mockContext = {
      fillRect: jest.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;

    mockElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement;

    mockGenerator = {
      frame: jest.fn().mockReturnValue({
        backgroundColor: "#ff0000",
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

  it("should set up 100x100 canvas on construction", () => {
    new CanvasRenderer(mockElement, mockGenerator);

    expect(mockElement.width).toBe(100);
    expect(mockElement.height).toBe(100);
  });

  it("should throw if canvas context is not available", () => {
    mockElement.getContext = jest.fn().mockReturnValue(null);

    expect(() => new CanvasRenderer(mockElement, mockGenerator)).toThrow(
      "Could not get 2d context from canvas"
    );
  });

  it("should render the background color from the generator", () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    renderer.render(0);

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
    expect(mockContext.fillStyle).toBe("#ff0000");
    expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("should default time to zero", () => {
    const renderer = new CanvasRenderer(mockElement, mockGenerator);

    renderer.render();

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
  });
});
