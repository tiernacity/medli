import { ProceduralGenerator } from "../index";

describe("ProceduralGenerator", () => {
  it("should return a frame with default background color", () => {
    const generator = new ProceduralGenerator();
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#000000");
  });

  it("should return a frame with configured background color", () => {
    const generator = new ProceduralGenerator({ backgroundColor: "#ff0000" });
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#ff0000");
  });

  it("should default time to zero", () => {
    const generator = new ProceduralGenerator({ backgroundColor: "#00ff00" });
    const frame = generator.frame();
    expect(frame.backgroundColor).toBe("#00ff00");
  });
});
