import { ObjectGenerator } from "../index";

describe("ObjectGenerator", () => {
  it("should return the shapes from the definition", () => {
    const shapes = [
      { type: "point", x: 1, y: 2 },
      { type: "point", x: 3, y: 4 },
    ];
    const generator = new ObjectGenerator({ shapes });
    const result = generator.generate();
    expect(result).toEqual(shapes);
  });

  it("should return a copy of the shapes array", () => {
    const shapes = [{ type: "point", x: 1, y: 2 }];
    const generator = new ObjectGenerator({ shapes });
    const result = generator.generate();
    expect(result).not.toBe(shapes);
    expect(result).toEqual(shapes);
  });

  it("should handle empty shapes array", () => {
    const generator = new ObjectGenerator({ shapes: [] });
    const result = generator.generate();
    expect(result).toHaveLength(0);
  });
});
