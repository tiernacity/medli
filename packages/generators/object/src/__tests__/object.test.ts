import { Scene, Background, SceneObject } from "../index";
import type { Frame } from "@medli/spec";

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
    const partial = bg.frame(0);
    expect(partial.backgroundColor).toBe("#ff0000");
  });
});

describe("SceneObject integration", () => {
  it("should merge frame data from children", () => {
    // Custom scene object for testing
    class TestObject implements SceneObject {
      frame(_time: number): Partial<Frame> {
        return { backgroundColor: "#0000ff" };
      }
    }

    const scene = new Scene();
    scene.setBackground(new Background("#ff0000"));
    scene.add(new TestObject());

    // Child overwrites background
    const frame = scene.frame(0);
    expect(frame.backgroundColor).toBe("#0000ff");
  });

  it("should apply children in order", () => {
    class ColorObject implements SceneObject {
      constructor(private color: string) {}
      frame(_time: number): Partial<Frame> {
        return { backgroundColor: this.color };
      }
    }

    const scene = new Scene();
    scene.add(new ColorObject("#ff0000"));
    scene.add(new ColorObject("#00ff00"));
    scene.add(new ColorObject("#0000ff"));

    // Last child wins
    const frame = scene.frame(0);
    expect(frame.backgroundColor).toBe("#0000ff");
  });
});
