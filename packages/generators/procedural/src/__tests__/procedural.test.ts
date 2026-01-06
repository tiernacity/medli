import { ProceduralGenerator } from "../index";

describe("ProceduralGenerator", () => {
  it("should generate the specified number of shapes", () => {
    const generator = new ProceduralGenerator({ count: 5 });
    const shapes = generator.generate();
    expect(shapes).toHaveLength(5);
  });

  it("should generate shapes with sequential coordinates", () => {
    const generator = new ProceduralGenerator({ count: 3 });
    const shapes = generator.generate();
    expect(shapes[0]).toEqual({ type: "point", x: 0, y: 0 });
    expect(shapes[1]).toEqual({ type: "point", x: 1, y: 1 });
    expect(shapes[2]).toEqual({ type: "point", x: 2, y: 2 });
  });

  it("should generate empty array when count is 0", () => {
    const generator = new ProceduralGenerator({ count: 0 });
    const shapes = generator.generate();
    expect(shapes).toHaveLength(0);
  });
});
