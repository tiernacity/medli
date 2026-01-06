import { CanvasRenderer, CanvasContext } from "../index";

describe("CanvasRenderer", () => {
  it("should call fillRect for each shape", () => {
    const mockContext: CanvasContext = {
      fillRect: jest.fn(),
    };
    const renderer = new CanvasRenderer({ context: mockContext });

    renderer.render([
      { type: "point", x: 10, y: 20 },
      { type: "point", x: 30, y: 40 },
    ]);

    expect(mockContext.fillRect).toHaveBeenCalledTimes(2);
    expect(mockContext.fillRect).toHaveBeenCalledWith(10, 20, 1, 1);
    expect(mockContext.fillRect).toHaveBeenCalledWith(30, 40, 1, 1);
  });

  it("should handle empty shapes array", () => {
    const mockContext: CanvasContext = {
      fillRect: jest.fn(),
    };
    const renderer = new CanvasRenderer({ context: mockContext });

    renderer.render([]);

    expect(mockContext.fillRect).not.toHaveBeenCalled();
  });
});
