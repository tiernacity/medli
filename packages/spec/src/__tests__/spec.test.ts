import type { Frame, Generator, Renderer } from "../index";

describe("spec types", () => {
  it("should allow creating a frame", () => {
    const frame: Frame = {
      backgroundColor: "#ff0000",
    };
    expect(frame.backgroundColor).toBe("#ff0000");
  });

  it("should allow implementing Generator interface", () => {
    const generator: Generator = {
      frame: (time = 0) => ({ backgroundColor: `hsl(${time}, 50%, 50%)` }),
    };
    const frame = generator.frame(0);
    expect(frame.backgroundColor).toBe("hsl(0, 50%, 50%)");
  });

  it("should allow implementing Renderer interface", () => {
    let lastTime = -1;
    let looping = false;

    const renderer: Renderer = {
      render: (time = 0) => {
        lastTime = time;
      },
      loop: () => {
        looping = true;
      },
      stop: () => {
        looping = false;
      },
    };

    renderer.render(42);
    expect(lastTime).toBe(42);

    renderer.loop();
    expect(looping).toBe(true);

    renderer.stop();
    expect(looping).toBe(false);
  });
});
