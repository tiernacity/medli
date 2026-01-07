import { ObjectGenerator } from "../index";

describe("ObjectGenerator", () => {
  it("should return a frame with the defined background color", () => {
    const generator = new ObjectGenerator({ backgroundColor: "#ff0000" });
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#ff0000");
  });

  it("should default time to zero", () => {
    const generator = new ObjectGenerator({ backgroundColor: "#00ff00" });
    const frame = generator.frame();
    expect(frame.backgroundColor).toBe("#00ff00");
  });
});
