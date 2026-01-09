import { Scene, Background, Circle, Material, Line, Image } from "../index";
import type {
  ChildMaterial,
  RootMaterial,
  Image as ImageShape,
} from "@medli/spec";

const defaultViewport = {
  halfWidth: 50,
  halfHeight: 50,
  scaleMode: "fit" as const,
};

describe("Scene", () => {
  it("should return empty frame with no background", () => {
    const scene = new Scene(defaultViewport);
    const frame = scene.frame(0);
    expect(frame.background).toBeUndefined();
  });

  it("should return background color when background is set", () => {
    const scene = new Scene(defaultViewport);
    scene.setBackground(new Background("#ff0000"));
    const frame = scene.frame(0);
    expect(frame.background).toBe("#ff0000");
  });

  it("should allow adding background via add()", () => {
    const scene = new Scene(defaultViewport);
    const bg = new Background("#00ff00");
    scene.add(bg);
    expect(scene.background).toBe(bg);
    expect(scene.frame(0).background).toBe("#00ff00");
  });

  it("should allow removing background", () => {
    const scene = new Scene(defaultViewport);
    const bg = new Background("#ff0000");
    scene.setBackground(bg);
    scene.remove(bg);
    expect(scene.background).toBeNull();
    expect(scene.frame(0).background).toBeUndefined();
  });

  it("should allow setting background to null", () => {
    const scene = new Scene(defaultViewport);
    scene.setBackground(new Background("#ff0000"));
    scene.setBackground(null);
    expect(scene.background).toBeNull();
  });

  it("should support method chaining", () => {
    const scene = new Scene(defaultViewport);
    const result = scene.setBackground(new Background("#ff0000"));
    expect(result).toBe(scene);
  });

  it("should implement Generator interface", () => {
    const scene = new Scene(defaultViewport);
    expect(typeof scene.frame).toBe("function");
  });

  it("should include viewport in frame output", () => {
    const scene = new Scene(defaultViewport);
    const frame = scene.frame(0);
    expect(frame.viewport).toEqual(defaultViewport);
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
    const scene = new Scene(defaultViewport);
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
    const scene = new Scene(defaultViewport);
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

describe("Scene material properties", () => {
  it("should use default fill/stroke/strokeWidth in root material", () => {
    const scene = new Scene(defaultViewport);
    const frame = scene.frame(0);

    expect(frame.root.fill).toBe("#000000");
    expect(frame.root.stroke).toBe("#000000");
    expect(frame.root.strokeWidth).toBe(1);
  });

  it("should use custom fill when set on scene", () => {
    const scene = new Scene(defaultViewport);
    scene.fill = "#ff0000";

    const frame = scene.frame(0);
    expect(frame.root.fill).toBe("#ff0000");
  });

  it("should use custom stroke when set on scene", () => {
    const scene = new Scene(defaultViewport);
    scene.stroke = "#00ff00";

    const frame = scene.frame(0);
    expect(frame.root.stroke).toBe("#00ff00");
  });

  it("should use custom strokeWidth when set on scene", () => {
    const scene = new Scene(defaultViewport);
    scene.strokeWidth = 5;

    const frame = scene.frame(0);
    expect(frame.root.strokeWidth).toBe(5);
  });

  it("should reflect all material property changes in root material", () => {
    const scene = new Scene(defaultViewport);
    scene.fill = "#ff0000";
    scene.stroke = "#00ff00";
    scene.strokeWidth = 3;

    const frame = scene.frame(0);
    expect(frame.root.fill).toBe("#ff0000");
    expect(frame.root.stroke).toBe("#00ff00");
    expect(frame.root.strokeWidth).toBe(3);
  });
});

describe("Editing Scene material properties", () => {
  it("should update root material fill when scene.fill changes between frames", () => {
    const scene = new Scene(defaultViewport);
    scene.fill = "#ff0000";

    const frame1 = scene.frame(0);
    expect(frame1.root.fill).toBe("#ff0000");

    scene.fill = "#0000ff";
    const frame2 = scene.frame(1);
    expect(frame2.root.fill).toBe("#0000ff");
  });

  it("should update root material stroke when scene.stroke changes between frames", () => {
    const scene = new Scene(defaultViewport);
    scene.stroke = "#ff0000";

    const frame1 = scene.frame(0);
    expect(frame1.root.stroke).toBe("#ff0000");

    scene.stroke = "#00ff00";
    const frame2 = scene.frame(1);
    expect(frame2.root.stroke).toBe("#00ff00");
  });

  it("should update root material strokeWidth when scene.strokeWidth changes between frames", () => {
    const scene = new Scene(defaultViewport);
    scene.strokeWidth = 2;

    const frame1 = scene.frame(0);
    expect(frame1.root.strokeWidth).toBe(2);

    scene.strokeWidth = 10;
    const frame2 = scene.frame(1);
    expect(frame2.root.strokeWidth).toBe(10);
  });
});

describe("Material class", () => {
  it("should be constructable with no arguments", () => {
    const material = new Material();
    expect(material).toBeInstanceOf(Material);
  });

  it("should be constructable with partial style - fill only", () => {
    const material = new Material({ fill: "#ff0000" });
    expect(material.fill).toBe("#ff0000");
    expect(material.stroke).toBeUndefined();
    expect(material.strokeWidth).toBeUndefined();
  });

  it("should be constructable with partial style - stroke only", () => {
    const material = new Material({ stroke: "#00ff00" });
    expect(material.fill).toBeUndefined();
    expect(material.stroke).toBe("#00ff00");
    expect(material.strokeWidth).toBeUndefined();
  });

  it("should be constructable with partial style - strokeWidth only", () => {
    const material = new Material({ strokeWidth: 5 });
    expect(material.fill).toBeUndefined();
    expect(material.stroke).toBeUndefined();
    expect(material.strokeWidth).toBe(5);
  });

  it("should be constructable with full style", () => {
    const material = new Material({
      fill: "#ff0000",
      stroke: "#00ff00",
      strokeWidth: 3,
    });
    expect(material.fill).toBe("#ff0000");
    expect(material.stroke).toBe("#00ff00");
    expect(material.strokeWidth).toBe(3);
  });

  it("should have a unique id", () => {
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ fill: "#00ff00" });

    expect(material1.id).toBeTruthy();
    expect(material2.id).toBeTruthy();
    expect(material1.id).not.toBe(material2.id);
  });

  it("should implement SceneObject interface", () => {
    const material = new Material({ fill: "#ff0000" });
    expect(typeof material.frame).toBe("function");
  });
});

describe("Shape.material property (three.js-style API)", () => {
  it("should allow setting material on Circle", () => {
    const material = new Material({ fill: "#ff0000" });
    const circle = new Circle(50, 50, 10);
    circle.material = material;

    expect(circle.material).toBe(material);
  });

  it("should allow setting material on Line", () => {
    const material = new Material({ stroke: "#ff0000" });
    const line = new Line(0, 0, 100, 100);
    line.material = material;

    expect(line.material).toBe(material);
  });

  it("should default material to undefined", () => {
    const circle = new Circle(50, 50, 10);
    expect(circle.material).toBeUndefined();

    const line = new Line(0, 0, 100, 100);
    expect(line.material).toBeUndefined();
  });
});

describe("Material as ChildMaterial in frame", () => {
  it("should become a ChildMaterial node when added to scene", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    scene.add(material);

    const frame = scene.frame(0);

    expect(frame.root.children.length).toBe(1);
    const childNode = frame.root.children[0] as ChildMaterial;
    expect(childNode.type).toBe("material");
    expect(childNode.fill).toBe("#ff0000");
  });

  it("should have ref pointing to root material", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    scene.add(material);

    const frame = scene.frame(0);

    const childNode = frame.root.children[0] as ChildMaterial;
    expect(childNode.ref).toBe("root");
  });

  it("should have unique id for each material", () => {
    const scene = new Scene(defaultViewport);
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ fill: "#00ff00" });
    scene.add(material1);
    scene.add(material2);

    const frame = scene.frame(0);

    const child1 = frame.root.children[0] as ChildMaterial;
    const child2 = frame.root.children[1] as ChildMaterial;
    expect(child1.id).not.toBe(child2.id);
    expect(child1.id).toBeTruthy();
    expect(child2.id).toBeTruthy();
  });

  it("should only include defined style properties in ChildMaterial", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" }); // Only fill set
    scene.add(material);

    const frame = scene.frame(0);

    const childNode = frame.root.children[0] as ChildMaterial;
    expect(childNode.fill).toBe("#ff0000");
    expect(childNode.stroke).toBeUndefined();
    expect(childNode.strokeWidth).toBeUndefined();
  });
});

describe("Material edits take effect next frame", () => {
  it("should reflect fill changes in subsequent frame() calls", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    scene.add(material);

    const frame1 = scene.frame(0);
    const child1 = frame1.root.children[0] as ChildMaterial;
    expect(child1.fill).toBe("#ff0000");

    material.fill = "#0000ff";

    const frame2 = scene.frame(1);
    const child2 = frame2.root.children[0] as ChildMaterial;
    expect(child2.fill).toBe("#0000ff");
  });

  it("should reflect stroke changes in subsequent frame() calls", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ stroke: "#ff0000" });
    scene.add(material);

    const frame1 = scene.frame(0);
    const child1 = frame1.root.children[0] as ChildMaterial;
    expect(child1.stroke).toBe("#ff0000");

    material.stroke = "#00ff00";

    const frame2 = scene.frame(1);
    const child2 = frame2.root.children[0] as ChildMaterial;
    expect(child2.stroke).toBe("#00ff00");
  });

  it("should reflect strokeWidth changes in subsequent frame() calls", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ strokeWidth: 2 });
    scene.add(material);

    const frame1 = scene.frame(0);
    const child1 = frame1.root.children[0] as ChildMaterial;
    expect(child1.strokeWidth).toBe(2);

    material.strokeWidth = 10;

    const frame2 = scene.frame(1);
    const child2 = frame2.root.children[0] as ChildMaterial;
    expect(child2.strokeWidth).toBe(10);
  });

  it("should allow adding new style properties after creation", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material(); // No styles initially
    scene.add(material);

    const frame1 = scene.frame(0);
    const child1 = frame1.root.children[0] as ChildMaterial;
    expect(child1.fill).toBeUndefined();

    material.fill = "#ff0000";

    const frame2 = scene.frame(1);
    const child2 = frame2.root.children[0] as ChildMaterial;
    expect(child2.fill).toBe("#ff0000");
  });
});

describe("Shapes referencing materials (three.js-style)", () => {
  it("should place shapes with material reference in that Material's children array", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    const circle = new Circle(50, 50, 10);
    circle.material = material;

    scene.add(material);
    scene.add(circle);

    const frame = scene.frame(0);

    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.children.length).toBe(1);
    expect(childMaterial.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });

  it("should collect multiple shapes referencing the same Material", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });

    const circle1 = new Circle(10, 10, 5);
    circle1.material = material;
    const circle2 = new Circle(90, 90, 5);
    circle2.material = material;

    scene.add(material);
    scene.add(circle1);
    scene.add(circle2);

    const frame = scene.frame(0);

    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.children.length).toBe(2);
  });

  it("should place Line shapes in Material children array", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ stroke: "#ff0000", strokeWidth: 2 });
    const line = new Line(0, 0, 100, 100);
    line.material = material;

    scene.add(material);
    scene.add(line);

    const frame = scene.frame(0);

    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.children.length).toBe(1);
    expect(childMaterial.children[0]).toEqual({
      type: "line",
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    });
  });

  it("should keep shapes without material in root material children", () => {
    const scene = new Scene(defaultViewport);
    const circle1 = new Circle(50, 50, 10); // No material - goes to root

    const material = new Material({ fill: "#ff0000" });
    const circle2 = new Circle(25, 25, 5);
    circle2.material = material;

    scene.add(circle1);
    scene.add(material);
    scene.add(circle2);

    const frame = scene.frame(0);

    // Root should have circle and material as children
    expect(frame.root.children.length).toBe(2);
    expect(frame.root.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });

    const childMaterial = frame.root.children[1] as ChildMaterial;
    expect(childMaterial.type).toBe("material");
    expect(childMaterial.children[0]).toEqual({
      type: "circle",
      center: { x: 25, y: 25 },
      radius: 5,
    });
  });
});

describe("Nested Materials via parent property", () => {
  it("should allow Material to have a parent Material", () => {
    const scene = new Scene(defaultViewport);
    const outerMaterial = new Material({ fill: "#ff0000" });
    const innerMaterial = new Material({ stroke: "#00ff00" });
    innerMaterial.parent = outerMaterial;

    scene.add(outerMaterial);
    scene.add(innerMaterial);

    const frame = scene.frame(0);

    const outerChild = frame.root.children[0] as ChildMaterial;
    expect(outerChild.type).toBe("material");
    expect(outerChild.fill).toBe("#ff0000");

    expect(outerChild.children.length).toBe(1);
    const innerChild = outerChild.children[0] as ChildMaterial;
    expect(innerChild.type).toBe("material");
    expect(innerChild.stroke).toBe("#00ff00");
  });

  it("should have nested Material ref pointing to parent Material id", () => {
    const scene = new Scene(defaultViewport);
    const outerMaterial = new Material({ fill: "#ff0000" });
    const innerMaterial = new Material({ stroke: "#00ff00" });
    innerMaterial.parent = outerMaterial;

    scene.add(outerMaterial);
    scene.add(innerMaterial);

    const frame = scene.frame(0);

    const outerChild = frame.root.children[0] as ChildMaterial;
    const innerChild = outerChild.children[0] as ChildMaterial;

    // Inner material should ref outer material's id
    expect(innerChild.ref).toBe(outerChild.id);
  });

  it("should support deeply nested Materials (3+ levels)", () => {
    const scene = new Scene(defaultViewport);
    const level1 = new Material({ fill: "#ff0000" });
    const level2 = new Material({ stroke: "#00ff00" });
    const level3 = new Material({ strokeWidth: 5 });
    const circle = new Circle(50, 50, 10);

    level2.parent = level1;
    level3.parent = level2;
    circle.material = level3;

    scene.add(level1);
    scene.add(level2);
    scene.add(level3);
    scene.add(circle);

    const frame = scene.frame(0);

    const l1 = frame.root.children[0] as ChildMaterial;
    expect(l1.fill).toBe("#ff0000");
    expect(l1.ref).toBe("root");

    const l2 = l1.children[0] as ChildMaterial;
    expect(l2.stroke).toBe("#00ff00");
    expect(l2.ref).toBe(l1.id);

    const l3 = l2.children[0] as ChildMaterial;
    expect(l3.strokeWidth).toBe(5);
    expect(l3.ref).toBe(l2.id);

    expect(l3.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });

  it("should collect shapes from nested Material's children", () => {
    const scene = new Scene(defaultViewport);
    const outerMaterial = new Material({ fill: "#ff0000" });
    const innerMaterial = new Material({ stroke: "#00ff00" });
    innerMaterial.parent = outerMaterial;

    const circle = new Circle(50, 50, 10);
    circle.material = innerMaterial;

    scene.add(outerMaterial);
    scene.add(innerMaterial);
    scene.add(circle);

    const frame = scene.frame(0);

    const outerChild = frame.root.children[0] as ChildMaterial;
    const innerChild = outerChild.children[0] as ChildMaterial;
    expect(innerChild.children.length).toBe(1);
    expect(innerChild.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });
});

describe("Multiple Materials as siblings", () => {
  it("should create sibling ChildMaterial nodes when multiple Materials added to Scene", () => {
    const scene = new Scene(defaultViewport);
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ fill: "#00ff00" });
    scene.add(material1);
    scene.add(material2);

    const frame = scene.frame(0);

    expect(frame.root.children.length).toBe(2);
    const child1 = frame.root.children[0] as ChildMaterial;
    const child2 = frame.root.children[1] as ChildMaterial;
    expect(child1.type).toBe("material");
    expect(child2.type).toBe("material");
    expect(child1.fill).toBe("#ff0000");
    expect(child2.fill).toBe("#00ff00");
  });

  it("should give sibling Materials the same parent ref", () => {
    const scene = new Scene(defaultViewport);
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ fill: "#00ff00" });
    scene.add(material1);
    scene.add(material2);

    const frame = scene.frame(0);

    const child1 = frame.root.children[0] as ChildMaterial;
    const child2 = frame.root.children[1] as ChildMaterial;
    expect(child1.ref).toBe("root");
    expect(child2.ref).toBe("root");
  });

  it("should preserve order of sibling Materials", () => {
    const scene = new Scene(defaultViewport);
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ fill: "#00ff00" });
    const material3 = new Material({ fill: "#0000ff" });
    scene.add(material1);
    scene.add(material2);
    scene.add(material3);

    const frame = scene.frame(0);

    expect(frame.root.children.length).toBe(3);
    expect((frame.root.children[0] as ChildMaterial).fill).toBe("#ff0000");
    expect((frame.root.children[1] as ChildMaterial).fill).toBe("#00ff00");
    expect((frame.root.children[2] as ChildMaterial).fill).toBe("#0000ff");
  });

  it("should mix shapes and Materials as siblings", () => {
    const scene = new Scene(defaultViewport);
    const material1 = new Material({ fill: "#ff0000" });
    const material2 = new Material({ stroke: "#00ff00" });

    scene.add(new Circle(10, 10, 5));
    scene.add(material1);
    scene.add(new Circle(90, 90, 5));
    scene.add(material2);

    const frame = scene.frame(0);

    expect(frame.root.children.length).toBe(4);
    expect(frame.root.children[0]).toEqual({
      type: "circle",
      center: { x: 10, y: 10 },
      radius: 5,
    });
    expect((frame.root.children[1] as ChildMaterial).type).toBe("material");
    expect((frame.root.children[1] as ChildMaterial).fill).toBe("#ff0000");
    expect(frame.root.children[2]).toEqual({
      type: "circle",
      center: { x: 90, y: 90 },
      radius: 5,
    });
    expect((frame.root.children[3] as ChildMaterial).type).toBe("material");
    expect((frame.root.children[3] as ChildMaterial).stroke).toBe("#00ff00");
  });

  it("should create nested sibling Materials within a parent Material", () => {
    const scene = new Scene(defaultViewport);
    const parentMaterial = new Material({ fill: "#ff0000" });
    const childMaterial1 = new Material({ stroke: "#00ff00" });
    const childMaterial2 = new Material({ strokeWidth: 5 });

    childMaterial1.parent = parentMaterial;
    childMaterial2.parent = parentMaterial;

    scene.add(parentMaterial);
    scene.add(childMaterial1);
    scene.add(childMaterial2);

    const frame = scene.frame(0);

    const parent = frame.root.children[0] as ChildMaterial;
    expect(parent.children.length).toBe(2);
    const child1 = parent.children[0] as ChildMaterial;
    const child2 = parent.children[1] as ChildMaterial;
    expect(child1.stroke).toBe("#00ff00");
    expect(child2.strokeWidth).toBe(5);
    expect(child1.ref).toBe(parent.id);
    expect(child2.ref).toBe(parent.id);
  });
});

describe("Materials and shapes both added to scene independently", () => {
  it("should group shapes by material even when added in mixed order", () => {
    const scene = new Scene(defaultViewport);
    const redMaterial = new Material({ fill: "#ff0000" });
    const blueMaterial = new Material({ fill: "#0000ff" });

    const circle1 = new Circle(10, 10, 5);
    circle1.material = redMaterial;
    const circle2 = new Circle(20, 20, 5);
    circle2.material = blueMaterial;
    const circle3 = new Circle(30, 30, 5);
    circle3.material = redMaterial;

    // Add in mixed order
    scene.add(circle1);
    scene.add(redMaterial);
    scene.add(circle2);
    scene.add(blueMaterial);
    scene.add(circle3);

    const frame = scene.frame(0);

    // Should have two materials in root
    expect(frame.root.children.length).toBe(2);

    const redChild = frame.root.children[0] as ChildMaterial;
    const blueChild = frame.root.children[1] as ChildMaterial;

    // Red material should have circles at (10,10) and (30,30)
    expect(redChild.fill).toBe("#ff0000");
    expect(redChild.children.length).toBe(2);

    // Blue material should have circle at (20,20)
    expect(blueChild.fill).toBe("#0000ff");
    expect(blueChild.children.length).toBe(1);
  });

  it("should include material in frame even if shape references it but material not explicitly added", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    const circle = new Circle(50, 50, 10);
    circle.material = material;

    // Only add shape, not material directly
    scene.add(circle);

    const frame = scene.frame(0);

    // Material should still appear because shape references it
    expect(frame.root.children.length).toBe(1);
    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.fill).toBe("#ff0000");
    expect(childMaterial.children.length).toBe(1);
  });
});

// ============================================================================
// Matrix Math Helpers Tests
// ============================================================================

import {
  Group,
  Position,
  identityMatrix,
  translateMatrix,
  rotateMatrix,
  scaleMatrix,
  multiplyMatrices,
  isIdentityMatrix,
} from "../index";
import type { Transform, Matrix2D } from "@medli/spec";

describe("Matrix helpers", () => {
  describe("identityMatrix", () => {
    it("should return [1, 0, 0, 1, 0, 0]", () => {
      expect(identityMatrix()).toEqual([1, 0, 0, 1, 0, 0]);
    });
  });

  describe("translateMatrix", () => {
    it("should create a translation matrix", () => {
      expect(translateMatrix(10, 20)).toEqual([1, 0, 0, 1, 10, 20]);
    });

    it("should handle zero translation", () => {
      expect(translateMatrix(0, 0)).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("should handle negative translation", () => {
      expect(translateMatrix(-5, -10)).toEqual([1, 0, 0, 1, -5, -10]);
    });
  });

  describe("rotateMatrix", () => {
    it("should create a rotation matrix for 0 radians (identity)", () => {
      const m = rotateMatrix(0);
      expect(m[0]).toBeCloseTo(1);
      expect(m[1]).toBeCloseTo(0);
      expect(m[2]).toBeCloseTo(0);
      expect(m[3]).toBeCloseTo(1);
      expect(m[4]).toBe(0);
      expect(m[5]).toBe(0);
    });

    it("should create a rotation matrix for PI/2 (90 degrees)", () => {
      const m = rotateMatrix(Math.PI / 2);
      expect(m[0]).toBeCloseTo(0);
      expect(m[1]).toBeCloseTo(1);
      expect(m[2]).toBeCloseTo(-1);
      expect(m[3]).toBeCloseTo(0);
      expect(m[4]).toBe(0);
      expect(m[5]).toBe(0);
    });

    it("should create a rotation matrix for PI (180 degrees)", () => {
      const m = rotateMatrix(Math.PI);
      expect(m[0]).toBeCloseTo(-1);
      expect(m[1]).toBeCloseTo(0);
      expect(m[2]).toBeCloseTo(0);
      expect(m[3]).toBeCloseTo(-1);
      expect(m[4]).toBe(0);
      expect(m[5]).toBe(0);
    });
  });

  describe("scaleMatrix", () => {
    it("should create a uniform scale matrix", () => {
      expect(scaleMatrix(2, 2)).toEqual([2, 0, 0, 2, 0, 0]);
    });

    it("should create a non-uniform scale matrix", () => {
      expect(scaleMatrix(2, 3)).toEqual([2, 0, 0, 3, 0, 0]);
    });

    it("should handle scale of 1 (identity)", () => {
      expect(scaleMatrix(1, 1)).toEqual([1, 0, 0, 1, 0, 0]);
    });
  });

  describe("multiplyMatrices", () => {
    it("should return identity when multiplying two identity matrices", () => {
      const identity = identityMatrix();
      expect(multiplyMatrices(identity, identity)).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("should return the same matrix when multiplying by identity", () => {
      const translate = translateMatrix(10, 20);
      const identity = identityMatrix();
      expect(multiplyMatrices(translate, identity)).toEqual(translate);
      expect(multiplyMatrices(identity, translate)).toEqual(translate);
    });

    it("should compose translations correctly", () => {
      const t1 = translateMatrix(10, 0);
      const t2 = translateMatrix(0, 20);
      expect(multiplyMatrices(t1, t2)).toEqual([1, 0, 0, 1, 10, 20]);
    });

    it("should compose translate * scale correctly", () => {
      // To apply scale first then translate: T * S
      // Matrix multiply is right-to-left: (T * S) * point
      const scale = scaleMatrix(2, 2);
      const translate = translateMatrix(10, 10);
      const result = multiplyMatrices(translate, scale); // T * S
      // Point (0,0) -> scale (0,0) -> translate (10,10)
      // Point (1,0) -> scale (2,0) -> translate (12,10)
      expect(result).toEqual([2, 0, 0, 2, 10, 10]);
    });
  });

  describe("isIdentityMatrix", () => {
    it("should return true for identity matrix", () => {
      expect(isIdentityMatrix([1, 0, 0, 1, 0, 0])).toBe(true);
    });

    it("should return false for translation matrix", () => {
      expect(isIdentityMatrix([1, 0, 0, 1, 10, 20])).toBe(false);
    });

    it("should return false for scale matrix", () => {
      expect(isIdentityMatrix([2, 0, 0, 2, 0, 0])).toBe(false);
    });

    it("should return false for rotation matrix", () => {
      const rot = rotateMatrix(Math.PI / 4);
      expect(isIdentityMatrix(rot)).toBe(false);
    });
  });
});

// ============================================================================
// Group Tests
// ============================================================================

describe("Group", () => {
  describe("construction and properties", () => {
    it("should have default position of {x: 0, y: 0}", () => {
      const group = new Group();
      expect(group.position).toEqual({ x: 0, y: 0 });
    });

    it("should have default rotation of 0", () => {
      const group = new Group();
      expect(group.rotation).toBe(0);
    });

    it("should have default scale of 1", () => {
      const group = new Group();
      expect(group.scale).toBe(1);
    });

    it("should allow setting position", () => {
      const group = new Group();
      group.position = { x: 50, y: 50 };
      expect(group.position).toEqual({ x: 50, y: 50 });
    });

    it("should allow setting rotation", () => {
      const group = new Group();
      group.rotation = Math.PI / 4;
      expect(group.rotation).toBe(Math.PI / 4);
    });

    it("should allow setting uniform scale", () => {
      const group = new Group();
      group.scale = 2;
      expect(group.scale).toBe(2);
    });

    it("should allow setting non-uniform scale", () => {
      const group = new Group();
      group.scale = { x: 2, y: 3 };
      expect(group.scale).toEqual({ x: 2, y: 3 });
    });
  });

  describe("add/remove children", () => {
    it("should add children", () => {
      const group = new Group();
      const circle = new Circle(0, 0, 10);
      group.add(circle);
      expect(group.getChildren()).toContain(circle);
    });

    it("should support method chaining for add", () => {
      const group = new Group();
      const circle = new Circle(0, 0, 10);
      expect(group.add(circle)).toBe(group);
    });

    it("should remove children", () => {
      const group = new Group();
      const circle = new Circle(0, 0, 10);
      group.add(circle);
      group.remove(circle);
      expect(group.getChildren()).not.toContain(circle);
    });

    it("should support method chaining for remove", () => {
      const group = new Group();
      const circle = new Circle(0, 0, 10);
      group.add(circle);
      expect(group.remove(circle)).toBe(group);
    });

    it("should return a copy of children from getChildren", () => {
      const group = new Group();
      const circle = new Circle(0, 0, 10);
      group.add(circle);
      const children = group.getChildren();
      children.push(new Circle(1, 1, 5));
      expect(group.getChildren().length).toBe(1);
    });
  });

  describe("computeMatrix", () => {
    it("should return identity matrix when no transform is applied", () => {
      const group = new Group();
      expect(group.computeMatrix()).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("should return translation matrix when only position is set", () => {
      const group = new Group();
      group.position = { x: 10, y: 20 };
      expect(group.computeMatrix()).toEqual([1, 0, 0, 1, 10, 20]);
    });

    it("should return scale matrix when only scale is set", () => {
      const group = new Group();
      group.scale = 2;
      expect(group.computeMatrix()).toEqual([2, 0, 0, 2, 0, 0]);
    });

    it("should return rotation matrix when only rotation is set", () => {
      const group = new Group();
      group.rotation = Math.PI / 2;
      const m = group.computeMatrix();
      expect(m[0]).toBeCloseTo(0);
      expect(m[1]).toBeCloseTo(1);
      expect(m[2]).toBeCloseTo(-1);
      expect(m[3]).toBeCloseTo(0);
      expect(m[4]).toBe(0);
      expect(m[5]).toBe(0);
    });

    it("should combine scale, rotation, and translation in TRS order", () => {
      const group = new Group();
      group.scale = 2;
      group.rotation = Math.PI / 2;
      group.position = { x: 10, y: 20 };

      const m = group.computeMatrix();
      // TRS order: scale -> rotate -> translate
      // Scale by 2, rotate 90deg, translate by (10, 20)
      expect(m[0]).toBeCloseTo(0); // 2 * cos(90) = 0
      expect(m[1]).toBeCloseTo(2); // 2 * sin(90) = 2
      expect(m[2]).toBeCloseTo(-2); // 2 * -sin(90) = -2
      expect(m[3]).toBeCloseTo(0); // 2 * cos(90) = 0
      expect(m[4]).toBeCloseTo(10); // translation x
      expect(m[5]).toBeCloseTo(20); // translation y
    });
  });

  describe("hasTransform", () => {
    it("should return false when no transform is applied", () => {
      const group = new Group();
      expect(group.hasTransform()).toBe(false);
    });

    it("should return true when position is set", () => {
      const group = new Group();
      group.position = { x: 10, y: 0 };
      expect(group.hasTransform()).toBe(true);
    });

    it("should return true when rotation is set", () => {
      const group = new Group();
      group.rotation = 0.1;
      expect(group.hasTransform()).toBe(true);
    });

    it("should return true when scale is not 1", () => {
      const group = new Group();
      group.scale = 2;
      expect(group.hasTransform()).toBe(true);
    });

    it("should return false when scale is 1 (default)", () => {
      const group = new Group();
      group.scale = 1;
      expect(group.hasTransform()).toBe(false);
    });
  });

  describe("frame() output", () => {
    it("should return children directly when no transform is applied", () => {
      const group = new Group();
      const circle = new Circle(50, 50, 10);
      group.add(circle);

      const nodes = group.frame(0);
      expect(nodes.length).toBe(1);
      expect(nodes[0]).toEqual({
        type: "circle",
        center: { x: 50, y: 50 },
        radius: 10,
      });
    });

    it("should wrap children in Transform node when transform is applied", () => {
      const group = new Group();
      group.position = { x: 10, y: 20 };
      const circle = new Circle(0, 0, 5);
      group.add(circle);

      const nodes = group.frame(0);
      expect(nodes.length).toBe(1);
      expect(nodes[0].type).toBe("transform");

      const transform = nodes[0] as Transform;
      expect(transform.matrix).toEqual([1, 0, 0, 1, 10, 20]);
      expect(transform.children.length).toBe(1);
      expect(transform.children[0]).toEqual({
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 5,
      });
    });

    it("should handle multiple children", () => {
      const group = new Group();
      group.position = { x: 50, y: 50 };
      group.add(new Circle(0, 0, 10));
      group.add(new Circle(20, 0, 5));

      const nodes = group.frame(0);
      expect(nodes.length).toBe(1);

      const transform = nodes[0] as Transform;
      expect(transform.children.length).toBe(2);
    });

    it("should handle nested groups", () => {
      const outerGroup = new Group();
      outerGroup.position = { x: 100, y: 100 };

      const innerGroup = new Group();
      innerGroup.position = { x: 10, y: 10 };
      innerGroup.add(new Circle(0, 0, 5));

      outerGroup.add(innerGroup);

      const nodes = outerGroup.frame(0);
      expect(nodes.length).toBe(1);

      const outerTransform = nodes[0] as Transform;
      expect(outerTransform.matrix).toEqual([1, 0, 0, 1, 100, 100]);
      expect(outerTransform.children.length).toBe(1);

      const innerTransform = outerTransform.children[0] as Transform;
      expect(innerTransform.type).toBe("transform");
      expect(innerTransform.matrix).toEqual([1, 0, 0, 1, 10, 10]);
    });
  });
});

describe("Group in Scene", () => {
  it("should add Group to scene and emit Transform node", () => {
    const scene = new Scene(defaultViewport);
    const group = new Group();
    group.position = { x: 50, y: 50 };
    group.add(new Circle(0, 0, 10));
    scene.add(group);

    const frame = scene.frame(0);
    expect(frame.root.children.length).toBe(1);

    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 50, 50]);
    expect(transform.children[0]).toEqual({
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 10,
    });
  });

  it("should not emit Transform node when group has no transform", () => {
    const scene = new Scene(defaultViewport);
    const group = new Group();
    group.add(new Circle(50, 50, 10));
    scene.add(group);

    const frame = scene.frame(0);
    expect(frame.root.children.length).toBe(1);
    // Should be the circle directly, not wrapped in transform
    expect(frame.root.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });

  it("should support Group containing shapes (shapes use Scene defaults)", () => {
    const scene = new Scene(defaultViewport);
    const group = new Group();
    group.position = { x: 50, y: 50 };

    // Circle inside the group - uses Scene's default material
    const circle = new Circle(0, 0, 10);
    group.add(circle);

    scene.add(group);

    const frame = scene.frame(0);

    // Group emits Transform directly to root
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 50, 50]);

    // Circle geometry is inside the transform (uses root material defaults)
    expect(transform.children[0]).toEqual({
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 10,
    });
  });

  it("should wrap shapes inside group with inline ChildMaterial when shape has material", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    const group = new Group();
    group.position = { x: 50, y: 50 };

    // Circle inside the group with material set
    // Group.frame() wraps this shape in an inline ChildMaterial node
    const circle = new Circle(0, 0, 10);
    circle.material = material;
    group.add(circle);

    scene.add(material);
    scene.add(group);

    const frame = scene.frame(0);

    // Material is first (added first) - empty since circle is inside Group
    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.type).toBe("material");
    expect(childMaterial.fill).toBe("#ff0000");
    expect(childMaterial.children.length).toBe(0);

    // Group emits Transform containing inline ChildMaterial
    const transform = frame.root.children[1] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 50, 50]);

    // The shape is wrapped in an inline ChildMaterial with the material's properties
    const inlineMaterial = transform.children[0] as ChildMaterial;
    expect(inlineMaterial.type).toBe("material");
    expect(inlineMaterial.fill).toBe("#ff0000");
    expect(inlineMaterial.ref).toBe("root");
    expect(inlineMaterial.id).toMatch(/^m\d+_inline_\d+$/);
    expect(inlineMaterial.children).toEqual([
      {
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 10,
      },
    ]);
  });

  it("should handle rotation with PI/4", () => {
    const scene = new Scene(defaultViewport);
    const group = new Group();
    group.rotation = Math.PI / 4;
    group.add(new Circle(10, 0, 5));
    scene.add(group);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;

    expect(transform.type).toBe("transform");
    // PI/4 rotation matrix: [cos, sin, -sin, cos, 0, 0]
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    expect(transform.matrix[0]).toBeCloseTo(cos45);
    expect(transform.matrix[1]).toBeCloseTo(sin45);
    expect(transform.matrix[2]).toBeCloseTo(-sin45);
    expect(transform.matrix[3]).toBeCloseTo(cos45);
  });

  it("should handle non-uniform scale", () => {
    const scene = new Scene(defaultViewport);
    const group = new Group();
    group.scale = { x: 2, y: 3 };
    group.add(new Circle(10, 10, 5));
    scene.add(group);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;

    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([2, 0, 0, 3, 0, 0]);
  });

  it("should work with shapes having transforms and materials", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#0000ff" });

    // Shape with both transform and material - no Group needed!
    const circle = new Circle(0, 0, 10);
    circle.position = { x: 50, y: 50 };
    circle.rotation = Math.PI / 4;
    circle.material = material;

    scene.add(material);
    scene.add(circle);

    const frame = scene.frame(0);

    // Material contains the transformed circle
    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.type).toBe("material");

    // Transform wraps the circle geometry
    const transform = childMaterial.children[0] as Transform;
    expect(transform.type).toBe("transform");

    // Circle geometry is inside transform
    expect(transform.children[0]).toEqual({
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 10,
    });
  });
});

describe("Shape transforms", () => {
  it("should allow Circle to have position transform", () => {
    const scene = new Scene(defaultViewport);
    const circle = new Circle(0, 0, 10);
    circle.position = { x: 50, y: 50 };
    scene.add(circle);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 50, 50]);
    expect(transform.children[0]).toEqual({
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 10,
    });
  });

  it("should allow Circle to have rotation transform", () => {
    const scene = new Scene(defaultViewport);
    const circle = new Circle(10, 0, 5);
    circle.rotation = Math.PI / 2;
    scene.add(circle);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix[0]).toBeCloseTo(0);
    expect(transform.matrix[1]).toBeCloseTo(1);
  });

  it("should allow Circle to have scale transform", () => {
    const scene = new Scene(defaultViewport);
    const circle = new Circle(0, 0, 10);
    circle.scale = 2;
    scene.add(circle);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("should allow Line to have position transform", () => {
    const scene = new Scene(defaultViewport);
    const line = new Line(0, 0, 10, 10);
    line.position = { x: 25, y: 25 };
    scene.add(line);

    const frame = scene.frame(0);
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 25, 25]);
    expect(transform.children[0]).toEqual({
      type: "line",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    });
  });

  it("should not wrap shape in Transform if no transform applied", () => {
    const scene = new Scene(defaultViewport);
    const circle = new Circle(50, 50, 10);
    // No position/rotation/scale set
    scene.add(circle);

    const frame = scene.frame(0);
    // Should be the circle directly, not wrapped in transform
    expect(frame.root.children[0]).toEqual({
      type: "circle",
      center: { x: 50, y: 50 },
      radius: 10,
    });
  });

  it("should combine transform and material on shapes", () => {
    const scene = new Scene(defaultViewport);
    const material = new Material({ fill: "#ff0000" });
    const circle = new Circle(0, 0, 10);
    circle.position = { x: 50, y: 50 };
    circle.material = material;

    scene.add(material);
    scene.add(circle);

    const frame = scene.frame(0);

    // Material node contains the transform
    const childMaterial = frame.root.children[0] as ChildMaterial;
    expect(childMaterial.type).toBe("material");
    expect(childMaterial.fill).toBe("#ff0000");

    // Transform is inside material
    const transform = childMaterial.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 50, 50]);

    // Circle geometry is inside transform
    expect(transform.children[0]).toEqual({
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 10,
    });
  });

  it("should inherit transform properties from SceneObject", () => {
    const circle = new Circle(0, 0, 10);
    // These should be inherited from SceneObject
    expect(circle.position).toEqual({ x: 0, y: 0 });
    expect(circle.rotation).toBe(0);
    expect(circle.scale).toBe(1);
    expect(typeof circle.computeMatrix).toBe("function");
    expect(typeof circle.hasTransform).toBe("function");
  });
});

// ============================================================================
// Image Tests
// ============================================================================

describe("Image", () => {
  describe("construction without crop", () => {
    it("should create an image with basic properties", () => {
      const image = new Image("https://example.com/image.png", 10, 20, 100, 50);
      expect(image.url).toBe("https://example.com/image.png");
      expect(image.x).toBe(10);
      expect(image.y).toBe(20);
      expect(image.width).toBe(100);
      expect(image.height).toBe(50);
    });

    it("should have undefined crop properties when not provided", () => {
      const image = new Image("https://example.com/image.png", 0, 0, 100, 100);
      expect(image.cropX).toBeUndefined();
      expect(image.cropY).toBeUndefined();
      expect(image.cropWidth).toBeUndefined();
      expect(image.cropHeight).toBeUndefined();
    });

    it("should output frame node without crop when crop not provided", () => {
      const scene = new Scene(defaultViewport);
      const image = new Image("https://example.com/image.png", 10, 20, 100, 50);
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode).toEqual({
        type: "image",
        url: "https://example.com/image.png",
        position: { x: 10, y: 20 },
        width: 100,
        height: 50,
      });
      expect(imageNode.crop).toBeUndefined();
    });
  });

  describe("construction with crop", () => {
    it("should create an image with crop properties", () => {
      const image = new Image(
        "https://example.com/image.png",
        10,
        20,
        100,
        50,
        0,
        0,
        200,
        100
      );
      expect(image.url).toBe("https://example.com/image.png");
      expect(image.x).toBe(10);
      expect(image.y).toBe(20);
      expect(image.width).toBe(100);
      expect(image.height).toBe(50);
      expect(image.cropX).toBe(0);
      expect(image.cropY).toBe(0);
      expect(image.cropWidth).toBe(200);
      expect(image.cropHeight).toBe(100);
    });

    it("should output frame node with crop when all crop values provided", () => {
      const scene = new Scene(defaultViewport);
      const image = new Image(
        "https://example.com/image.png",
        10,
        20,
        100,
        50,
        50,
        25,
        200,
        100
      );
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode).toEqual({
        type: "image",
        url: "https://example.com/image.png",
        position: { x: 10, y: 20 },
        width: 100,
        height: 50,
        crop: { x: 50, y: 25, width: 200, height: 100 },
      });
    });

    it("should support crop starting at origin (0, 0)", () => {
      const scene = new Scene(defaultViewport);
      const image = new Image(
        "https://example.com/image.png",
        0,
        0,
        50,
        50,
        0,
        0,
        100,
        100
      );
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode.crop).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });
  });

  describe("partial crop values", () => {
    it("should not include crop when only cropX is provided", () => {
      const image = new Image("https://example.com/image.png", 0, 0, 100, 100);
      image.cropX = 10;

      const scene = new Scene(defaultViewport);
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode.crop).toBeUndefined();
    });

    it("should not include crop when some crop values are undefined", () => {
      const image = new Image("https://example.com/image.png", 0, 0, 100, 100);
      image.cropX = 10;
      image.cropY = 20;
      // cropWidth and cropHeight remain undefined

      const scene = new Scene(defaultViewport);
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode.crop).toBeUndefined();
    });

    it("should include crop when all four values are set after construction", () => {
      const image = new Image("https://example.com/image.png", 0, 0, 100, 100);
      image.cropX = 10;
      image.cropY = 20;
      image.cropWidth = 50;
      image.cropHeight = 50;

      const scene = new Scene(defaultViewport);
      scene.add(image);

      const frame = scene.frame(0);
      const imageNode = frame.root.children[0] as ImageShape;

      expect(imageNode.crop).toEqual({ x: 10, y: 20, width: 50, height: 50 });
    });
  });

  describe("Image with transforms", () => {
    it("should support position transform with Image", () => {
      const scene = new Scene(defaultViewport);
      const image = new Image("https://example.com/image.png", 0, 0, 50, 50);
      image.position = { x: 25, y: 25 };
      scene.add(image);

      const frame = scene.frame(0);
      const transform = frame.root.children[0] as Transform;

      expect(transform.type).toBe("transform");
      expect(transform.matrix).toEqual([1, 0, 0, 1, 25, 25]);
      expect(transform.children[0]).toEqual({
        type: "image",
        url: "https://example.com/image.png",
        position: { x: 0, y: 0 },
        width: 50,
        height: 50,
      });
    });

    it("should support crop with transforms", () => {
      const scene = new Scene(defaultViewport);
      const image = new Image(
        "https://example.com/image.png",
        0,
        0,
        50,
        50,
        10,
        10,
        100,
        100
      );
      image.position = { x: 25, y: 25 };
      scene.add(image);

      const frame = scene.frame(0);
      const transform = frame.root.children[0] as Transform;
      const imageNode = transform.children[0] as ImageShape;

      expect(imageNode.crop).toEqual({ x: 10, y: 10, width: 100, height: 100 });
    });
  });

  describe("Image with materials", () => {
    it("should support material reference on Image", () => {
      const scene = new Scene(defaultViewport);
      const material = new Material({ fill: "#ff0000" });
      const image = new Image("https://example.com/image.png", 0, 0, 100, 100);
      image.material = material;

      scene.add(material);
      scene.add(image);

      const frame = scene.frame(0);
      const childMaterial = frame.root.children[0] as ChildMaterial;

      expect(childMaterial.type).toBe("material");
      expect(childMaterial.fill).toBe("#ff0000");
      expect(childMaterial.children.length).toBe(1);
      expect((childMaterial.children[0] as ImageShape).type).toBe("image");
    });
  });
});
