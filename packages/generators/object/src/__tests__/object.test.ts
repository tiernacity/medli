import { Scene, Background, Circle, Material, Line, Shape } from "../index";
import type { ChildMaterial, RootMaterial } from "@medli/spec";

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

describe("Scene material properties", () => {
  it("should use default fill/stroke/strokeWidth in root material", () => {
    const scene = new Scene();
    const frame = scene.frame(0);

    expect(frame.root.fill).toBe("#000000");
    expect(frame.root.stroke).toBe("#000000");
    expect(frame.root.strokeWidth).toBe(1);
  });

  it("should use custom fill when set on scene", () => {
    const scene = new Scene();
    scene.fill = "#ff0000";

    const frame = scene.frame(0);
    expect(frame.root.fill).toBe("#ff0000");
  });

  it("should use custom stroke when set on scene", () => {
    const scene = new Scene();
    scene.stroke = "#00ff00";

    const frame = scene.frame(0);
    expect(frame.root.stroke).toBe("#00ff00");
  });

  it("should use custom strokeWidth when set on scene", () => {
    const scene = new Scene();
    scene.strokeWidth = 5;

    const frame = scene.frame(0);
    expect(frame.root.strokeWidth).toBe(5);
  });

  it("should reflect all material property changes in root material", () => {
    const scene = new Scene();
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
    const scene = new Scene();
    scene.fill = "#ff0000";

    const frame1 = scene.frame(0);
    expect(frame1.root.fill).toBe("#ff0000");

    scene.fill = "#0000ff";
    const frame2 = scene.frame(1);
    expect(frame2.root.fill).toBe("#0000ff");
  });

  it("should update root material stroke when scene.stroke changes between frames", () => {
    const scene = new Scene();
    scene.stroke = "#ff0000";

    const frame1 = scene.frame(0);
    expect(frame1.root.stroke).toBe("#ff0000");

    scene.stroke = "#00ff00";
    const frame2 = scene.frame(1);
    expect(frame2.root.stroke).toBe("#00ff00");
  });

  it("should update root material strokeWidth when scene.strokeWidth changes between frames", () => {
    const scene = new Scene();
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
    const scene = new Scene();
    const material = new Material({ fill: "#ff0000" });
    scene.add(material);

    const frame = scene.frame(0);

    expect(frame.root.children.length).toBe(1);
    const childNode = frame.root.children[0] as ChildMaterial;
    expect(childNode.type).toBe("material");
    expect(childNode.fill).toBe("#ff0000");
  });

  it("should have ref pointing to root material", () => {
    const scene = new Scene();
    const material = new Material({ fill: "#ff0000" });
    scene.add(material);

    const frame = scene.frame(0);

    const childNode = frame.root.children[0] as ChildMaterial;
    expect(childNode.ref).toBe("root");
  });

  it("should have unique id for each material", () => {
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
    const scene = new Scene();
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
