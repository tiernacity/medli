import { Scene, Background, Circle } from "../index";

describe("Scene", () => {
  it("should return empty frame with no background", () => {
    const scene = new Scene();
    const frame = scene.frame(0);
    expect(frame.backgroundColor).toBeUndefined();
  });

  it("should return background color when background is set", () => {
    const scene = new Scene();
    scene.setBackground(new Background("#ff0000"));
    const frame = scene.frame(0);
    expect(frame.backgroundColor).toBe("#ff0000");
  });

  it("should allow adding background via add()", () => {
    const scene = new Scene();
    const bg = new Background("#00ff00");
    scene.add(bg);
    expect(scene.background).toBe(bg);
    expect(scene.frame(0).backgroundColor).toBe("#00ff00");
  });

  it("should allow removing background", () => {
    const scene = new Scene();
    const bg = new Background("#ff0000");
    scene.setBackground(bg);
    scene.remove(bg);
    expect(scene.background).toBeNull();
    expect(scene.frame(0).backgroundColor).toBeUndefined();
  });

  it("should allow setting background to null", () => {
    const scene = new Scene();
    scene.setBackground(new Background("#ff0000"));
    scene.setBackground(null);
    expect(scene.background).toBeNull();
  });

  it("should support method chaining", () => {
    const scene = new Scene();
    const result = scene.setBackground(new Background("#ff0000"));
    expect(result).toBe(scene);
  });

  it("should implement Generator interface", () => {
    const scene = new Scene();
    expect(typeof scene.frame).toBe("function");
  });
});

describe("Background", () => {
  it("should store color", () => {
    const bg = new Background("#ffffff");
    expect(bg.color).toBe("#ffffff");
  });

  it("should default to black", () => {
    const bg = new Background();
    expect(bg.color).toBe("#000000");
  });

  it("should implement SceneObject interface", () => {
    const bg = new Background("#ff0000");
    const nodes = bg.frame(0);
    // Background returns empty array - its color is read directly by Scene
    expect(nodes).toEqual([]);
  });
});

describe("SceneObject integration", () => {
  it("should collect shapes from children", () => {
    const scene = new Scene();
    scene.add(new Circle(50, 50, 10));

    const frame = scene.frame(0);
    // Frame has root material with circle as child
    expect(frame.root.children.length).toBe(1);
    expect(frame.root.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });

  it("should collect shapes from multiple children in order", () => {
    const scene = new Scene();
    scene.add(new Circle(10, 10, 5));
    scene.add(new Circle(90, 90, 5));

    const frame = scene.frame(0);
    expect(frame.root.children.length).toBe(2);
    expect((frame.root.children[0] as { center: { x: number } }).center.x).toBe(
      10
    );
    expect((frame.root.children[1] as { center: { x: number } }).center.x).toBe(
      90
    );
  });
});
