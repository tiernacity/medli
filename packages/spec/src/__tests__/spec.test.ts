import type { Generator, Renderer, Shape } from "../index";

describe("spec types", () => {
  it("should allow creating a shape", () => {
    const shape: Shape = {
      type: "point",
      x: 10,
      y: 20,
    };
    expect(shape.type).toBe("point");
    expect(shape.x).toBe(10);
    expect(shape.y).toBe(20);
  });

  it("should allow implementing Generator interface", () => {
    const generator: Generator = {
      generate: () => [{ type: "point", x: 0, y: 0 }],
    };
    const shapes = generator.generate();
    expect(shapes).toHaveLength(1);
  });

  it("should allow implementing Renderer interface", () => {
    const rendered: Shape[] = [];
    const renderer: Renderer = {
      render: (shapes) => {
        rendered.push(...shapes);
      },
    };
    renderer.render([{ type: "point", x: 5, y: 5 }]);
    expect(rendered).toHaveLength(1);
  });
});
