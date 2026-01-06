import { SvgRenderer } from "../index";

describe("SvgRenderer", () => {
  it("should render shapes to console", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const renderer = new SvgRenderer({ width: 100, height: 100 });

    renderer.render([{ type: "point", x: 10, y: 20 }]);

    expect(consoleSpy).toHaveBeenCalledWith('<svg width="100" height="100">');
    expect(consoleSpy).toHaveBeenCalledWith(
      '  <circle cx="10" cy="20" r="1" />'
    );
    expect(consoleSpy).toHaveBeenCalledWith("</svg>");

    consoleSpy.mockRestore();
  });

  it("should render multiple shapes", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const renderer = new SvgRenderer({ width: 200, height: 200 });

    renderer.render([
      { type: "point", x: 10, y: 20 },
      { type: "point", x: 30, y: 40 },
    ]);

    expect(consoleSpy).toHaveBeenCalledTimes(4); // opening, 2 circles, closing

    consoleSpy.mockRestore();
  });
});
