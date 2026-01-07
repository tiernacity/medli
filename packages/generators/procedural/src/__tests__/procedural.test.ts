import { ProceduralGenerator, Sketch } from "../index";

describe("ProceduralGenerator", () => {
  it("should return default black background when draw does nothing", () => {
    const generator = new ProceduralGenerator(() => {});
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#000000");
  });

  it("should return background color set in draw function", () => {
    const generator = new ProceduralGenerator((p) => {
      p.background("#ff0000");
    });
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#ff0000");
  });

  it("should use last background() call if called multiple times", () => {
    const generator = new ProceduralGenerator((p) => {
      p.background("#ff0000");
      p.background("#00ff00");
    });
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("#00ff00");
  });

  it("should pass time to draw function via sketch.time", () => {
    let capturedTime = -1;
    const generator = new ProceduralGenerator((p) => {
      capturedTime = p.time;
    });
    generator.frame(12345);
    expect(capturedTime).toBe(12345);
  });

  it("should reset frame state between frames", () => {
    let callCount = 0;
    const generator = new ProceduralGenerator((p) => {
      callCount++;
      if (callCount === 1) {
        p.background("#ff0000");
      }
      // Second call doesn't set background
    });

    const frame1 = generator.frame(0);
    expect(frame1.backgroundColor).toBe("#ff0000");

    const frame2 = generator.frame(1);
    expect(frame2.backgroundColor).toBe("#000000"); // Reset to default
  });
});

describe("Sketch interface", () => {
  it("should provide background function", () => {
    const generator = new ProceduralGenerator((p: Sketch) => {
      expect(typeof p.background).toBe("function");
    });
    generator.frame(0);
  });

  it("should provide readonly time property", () => {
    const generator = new ProceduralGenerator((p: Sketch) => {
      expect(typeof p.time).toBe("number");
    });
    generator.frame(100);
  });
});
