/**
 * @jest-environment jsdom
 */
import { SvgRenderer } from "../index";
import type { Generator } from "@medli/spec";

describe("SvgRenderer", () => {
  let mockElement: SVGSVGElement;
  let mockGenerator: Generator;
  let mockRect: SVGRectElement;
  let mockGroup: SVGGElement;

  beforeEach(() => {
    mockRect = {
      setAttribute: jest.fn(),
      style: { display: "" },
    } as unknown as SVGRectElement;

    mockGroup = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
    } as unknown as SVGGElement;

    mockElement = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
    } as unknown as SVGSVGElement;

    // Mock document.createElementNS to return appropriate element types
    jest.spyOn(document, "createElementNS").mockImplementation((_, tagName) => {
      if (tagName === "g") return mockGroup;
      return mockRect;
    });

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create root group and rect on construction", () => {
    new SvgRenderer(mockElement, mockGenerator);

    // Should create root group
    expect(document.createElementNS).toHaveBeenCalledWith(
      "http://www.w3.org/2000/svg",
      "g"
    );
    expect(mockElement.appendChild).toHaveBeenCalledWith(mockGroup);

    // Should create background rect inside the group
    expect(document.createElementNS).toHaveBeenCalledWith(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    expect(mockGroup.appendChild).toHaveBeenCalledWith(mockRect);
  });

  it("should set viewBox and preserveAspectRatio on render based on viewport", async () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    // viewBox should be centered: -halfWidth -halfHeight width height
    expect(mockElement.setAttribute).toHaveBeenCalledWith(
      "viewBox",
      "-50 -50 100 100"
    );
    // scaleMode "fit" maps to "xMidYMid meet"
    expect(mockElement.setAttribute).toHaveBeenCalledWith(
      "preserveAspectRatio",
      "xMidYMid meet"
    );
  });

  it("should apply Y-flip transform to root group on render", async () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockGroup.setAttribute).toHaveBeenCalledWith(
      "transform",
      "scale(1, -1)"
    );
  });

  it("should position background rect at viewport coordinates", async () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockRect.setAttribute).toHaveBeenCalledWith("x", "-50");
    expect(mockRect.setAttribute).toHaveBeenCalledWith("y", "-50");
    expect(mockRect.setAttribute).toHaveBeenCalledWith("width", "100");
    expect(mockRect.setAttribute).toHaveBeenCalledWith("height", "100");
  });

  it("should render the background color from the generator", async () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    await renderer.render(0);

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
    expect(mockRect.setAttribute).toHaveBeenCalledWith("fill", "#ff0000");
  });

  it("should default time to zero", async () => {
    const renderer = new SvgRenderer(mockElement, mockGenerator);

    await renderer.render();

    expect(mockGenerator.frame).toHaveBeenCalledWith(0);
  });

  it("should map scaleMode 'fill' to 'xMidYMid slice'", async () => {
    mockGenerator = {
      frame: jest.fn().mockReturnValue({
        background: "#ff0000",
        viewport: {
          halfWidth: 50,
          halfHeight: 50,
          scaleMode: "fill" as const,
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

    const renderer = new SvgRenderer(mockElement, mockGenerator);
    await renderer.render(0);

    expect(mockElement.setAttribute).toHaveBeenCalledWith(
      "preserveAspectRatio",
      "xMidYMid slice"
    );
  });

  it("should map scaleMode 'stretch' to 'none'", async () => {
    mockGenerator = {
      frame: jest.fn().mockReturnValue({
        background: "#ff0000",
        viewport: {
          halfWidth: 50,
          halfHeight: 50,
          scaleMode: "stretch" as const,
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

    const renderer = new SvgRenderer(mockElement, mockGenerator);
    await renderer.render(0);

    expect(mockElement.setAttribute).toHaveBeenCalledWith(
      "preserveAspectRatio",
      "none"
    );
  });
});
