/**
 * @jest-environment jsdom
 */
import { SvgRenderer } from "../index";
import type { Generator } from "@medli/spec";

describe("SvgRenderer", () => {
  let mockElement: SVGSVGElement;
  let mockGenerator: Generator;
  let mockRect: SVGRectElement;

  beforeEach(() => {
    mockRect = {
      setAttribute: jest.fn(),
    } as unknown as SVGRectElement;

    mockElement = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
    } as unknown as SVGSVGElement;

    // Mock document.createElementNS
    jest.spyOn(document, "createElementNS").mockReturnValue(mockRect);

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should set up 100x100 viewport on construction", () => {
    new SvgRenderer(mockElement, mockGenerator);

    expect(mockElement.setAttribute).toHaveBeenCalledWith("width", "100");
    expect(mockElement.setAttribute).toHaveBeenCalledWith("height", "100");
    expect(mockElement.setAttribute).toHaveBeenCalledWith(
      "viewBox",
      "0 0 100 100"
    );
  });

  it("should create a rect element on construction", () => {
    new SvgRenderer(mockElement, mockGenerator);

    expect(document.createElementNS).toHaveBeenCalledWith(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    expect(mockRect.setAttribute).toHaveBeenCalledWith("width", "100");
    expect(mockRect.setAttribute).toHaveBeenCalledWith("height", "100");
    expect(mockElement.appendChild).toHaveBeenCalledWith(mockRect);
  });

  it("should render the background color from the generator", () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    renderer.render(0);

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
    expect(mockRect.setAttribute).toHaveBeenCalledWith("fill", "#ff0000");
  });

  it("should default time to zero", () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    renderer.render();

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
  });
});
