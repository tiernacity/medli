import { ProceduralGenerator, Sketch } from "../index";
import type { ChildMaterial, Transform } from "@medli/spec";

describe("ProceduralGenerator", () => {
  it("should return undefined background when draw does nothing", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
    });
    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });
    expect(frame.background).toBeUndefined();
    expect(frame.viewport).toEqual({
      halfWidth: 50,
      halfHeight: 50,
      scaleMode: "fit",
    });
  });

  it("should return background color set in draw function", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.background("#ff0000");
    });
    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });
    expect(frame.background).toBe("#ff0000");
  });

  it("should use last background() call if called multiple times", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.background("#ff0000");
      p.background("#00ff00");
    });
    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });
    expect(frame.background).toBe("#00ff00");
  });

  it("should pass time to draw function via sketch.time", () => {
    let capturedTime = -1;
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      capturedTime = p.time;
    });
    generator.frame({ time: 12345, targetDimensions: [100, 100] });
    expect(capturedTime).toBe(12345);
  });

  it("should reset frame state between frames", () => {
    let callCount = 0;
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      callCount++;
      if (callCount === 1) {
        p.background("#ff0000");
      }
      // Second call doesn't set background
    });

    const frame1 = generator.frame({ time: 0, targetDimensions: [100, 100] });
    expect(frame1.background).toBe("#ff0000");

    const frame2 = generator.frame({ time: 1, targetDimensions: [100, 100] });
    expect(frame2.background).toBeUndefined(); // Reset to default (no background)
  });
});

describe("Sketch interface", () => {
  it("should provide background function", () => {
    const generator = new ProceduralGenerator((p: Sketch) => {
      p.viewport(50, 50);
      expect(typeof p.background).toBe("function");
    });
    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should provide readonly time property", () => {
    const generator = new ProceduralGenerator((p: Sketch) => {
      p.viewport(50, 50);
      expect(typeof p.time).toBe("number");
    });
    generator.frame({ time: 100, targetDimensions: [100, 100] });
  });
});

describe("Material output - Naive IR", () => {
  describe("Root material properties", () => {
    it("should have default root material properties always", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Root ALWAYS has defaults in naive IR
      expect(frame.root.fill).toBe("#000000");
      expect(frame.root.stroke).toBe("#000000");
      expect(frame.root.strokeWidth).toBe(1);
    });

    it("should create ChildMaterial when fill() called (not set root)", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("#ff0000");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Root still has defaults
      expect(frame.root.fill).toBe("#000000");

      // fill() creates a ChildMaterial containing the circle
      expect(frame.root.children).toHaveLength(1);
      const childMaterial = frame.root.children[0] as ChildMaterial;
      expect(childMaterial.type).toBe("material");
      expect(childMaterial.fill).toBe("#ff0000");
      expect(childMaterial.children).toHaveLength(1);
      expect(childMaterial.children[0].type).toBe("circle");
    });

    it("should create ChildMaterial when stroke() called (not set root)", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.stroke("#00ff00");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Root still has defaults
      expect(frame.root.stroke).toBe("#000000");

      // stroke() creates a ChildMaterial
      const childMaterial = frame.root.children[0] as ChildMaterial;
      expect(childMaterial.stroke).toBe("#00ff00");
    });

    it("should create ChildMaterial when strokeWidth() called (not set root)", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.strokeWidth(5);
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Root still has defaults
      expect(frame.root.strokeWidth).toBe(1);

      // strokeWidth() creates a ChildMaterial
      const childMaterial = frame.root.children[0] as ChildMaterial;
      expect(childMaterial.strokeWidth).toBe(5);
    });

    it("should create NESTED ChildMaterials for multiple style calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("#ff0000");
        p.fill("#00ff00");
        p.fill("#0000ff");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Each fill() creates a nested ChildMaterial
      // root > red > green > blue > circle
      const red = frame.root.children[0] as ChildMaterial;
      expect(red.fill).toBe("#ff0000");

      const green = red.children[0] as ChildMaterial;
      expect(green.fill).toBe("#00ff00");

      const blue = green.children[0] as ChildMaterial;
      expect(blue.fill).toBe("#0000ff");

      expect(blue.children[0].type).toBe("circle");
    });

    it("should create nested ChildMaterials for different style properties", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("#ff0000");
        p.stroke("#00ff00");
        p.strokeWidth(3);
        p.circle(50, 50, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Root has defaults
      expect(frame.root.fill).toBe("#000000");
      expect(frame.root.stroke).toBe("#000000");
      expect(frame.root.strokeWidth).toBe(1);

      // Each style call creates nested ChildMaterial
      // root > fill(red) > stroke(green) > strokeWidth(3) > circle
      const fillMat = frame.root.children[0] as ChildMaterial;
      expect(fillMat.fill).toBe("#ff0000");

      const strokeMat = fillMat.children[0] as ChildMaterial;
      expect(strokeMat.stroke).toBe("#00ff00");

      const widthMat = strokeMat.children[0] as ChildMaterial;
      expect(widthMat.strokeWidth).toBe(3);

      expect(widthMat.children[0].type).toBe("circle");
    });
  });

  describe("Shapes without style calls", () => {
    it("should place shape directly under root when no style calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.circle(10, 10, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Shape goes directly under root (inherits defaults)
      expect(frame.root.children).toHaveLength(1);
      expect(frame.root.children[0].type).toBe("circle");
    });

    it("should place multiple shapes directly under root when no style calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.circle(10, 10, 5);
        p.circle(20, 20, 5);
        p.rectangle(30, 30, 10, 10);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      expect(frame.root.children).toHaveLength(3);
      expect(frame.root.children[0].type).toBe("circle");
      expect(frame.root.children[1].type).toBe("circle");
      expect(frame.root.children[2].type).toBe("rectangle");
    });
  });

  describe("Consecutive shapes with style", () => {
    it("should place consecutive shapes in same ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.circle(10, 10, 5);
        p.circle(20, 20, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Single ChildMaterial contains both circles
      expect(frame.root.children).toHaveLength(1);
      const mat = frame.root.children[0] as ChildMaterial;
      expect(mat.fill).toBe("red");
      expect(mat.children).toHaveLength(2);
      expect(mat.children[0].type).toBe("circle");
      expect(mat.children[1].type).toBe("circle");
    });

    it("should create new nested ChildMaterial when style changes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.circle(10, 10, 5);
        p.fill("blue");
        p.circle(20, 20, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // First fill creates ChildMaterial, second fill creates nested ChildMaterial
      // root > red { circle, blue { circle } }
      expect(frame.root.children).toHaveLength(1);
      const redMat = frame.root.children[0] as ChildMaterial;
      expect(redMat.fill).toBe("red");
      expect(redMat.children).toHaveLength(2); // circle + blue material

      expect(redMat.children[0].type).toBe("circle");

      const blueMat = redMat.children[1] as ChildMaterial;
      expect(blueMat.fill).toBe("blue");
      expect(blueMat.children).toHaveLength(1);
      expect(blueMat.children[0].type).toBe("circle");
    });

    it("should create new nested ChildMaterial when stroke changes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.stroke("red");
        p.line(0, 0, 10, 10);
        p.stroke("blue");
        p.line(20, 20, 30, 30);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const redMat = frame.root.children[0] as ChildMaterial;
      expect(redMat.stroke).toBe("red");

      const blueMat = redMat.children[1] as ChildMaterial;
      expect(blueMat.stroke).toBe("blue");
    });

    it("should create new nested ChildMaterial when strokeWidth changes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.strokeWidth(2);
        p.line(0, 0, 10, 10);
        p.strokeWidth(5);
        p.line(20, 20, 30, 30);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const mat2 = frame.root.children[0] as ChildMaterial;
      expect(mat2.strokeWidth).toBe(2);

      const mat5 = mat2.children[1] as ChildMaterial;
      expect(mat5.strokeWidth).toBe(5);
    });

    it("should have unique IDs for each ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.circle(10, 10, 5);
        p.fill("blue");
        p.circle(20, 20, 5);
        p.fill("green");
        p.circle(30, 30, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Collect all material IDs from nested structure
      const ids: string[] = [];
      const collectIds = (node: ChildMaterial) => {
        ids.push(node.id);
        for (const child of node.children) {
          if (child.type === "material") {
            collectIds(child as ChildMaterial);
          }
        }
      };
      collectIds(frame.root.children[0] as ChildMaterial);

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("Nesting with push/pop", () => {
    it("should save and restore insertion point with push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.push();
        p.fill("blue");
        p.circle(10, 10, 5);
        p.pop();
        p.circle(20, 20, 5); // Goes back to red material
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root > red { blue { circle }, circle }
      const redMat = frame.root.children[0] as ChildMaterial;
      expect(redMat.fill).toBe("red");
      expect(redMat.children).toHaveLength(2);

      const blueMat = redMat.children[0] as ChildMaterial;
      expect(blueMat.fill).toBe("blue");
      expect(blueMat.children[0].type).toBe("circle");

      // Second circle goes back to red material after pop
      expect(redMat.children[1].type).toBe("circle");
    });

    it("should allow nested push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.push();
        p.fill("blue");
        p.push();
        p.fill("green");
        p.circle(10, 10, 5);
        p.pop();
        p.circle(15, 15, 5); // Back to blue
        p.pop();
        p.circle(20, 20, 5); // Back to red
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root > red { blue { green { circle }, circle }, circle }
      const redMat = frame.root.children[0] as ChildMaterial;
      expect(redMat.fill).toBe("red");

      const blueMat = redMat.children[0] as ChildMaterial;
      expect(blueMat.fill).toBe("blue");

      const greenMat = blueMat.children[0] as ChildMaterial;
      expect(greenMat.fill).toBe("green");
      expect(greenMat.children[0].type).toBe("circle");

      // After first pop - circle in blue
      expect(blueMat.children[1].type).toBe("circle");

      // After second pop - circle in red
      expect(redMat.children[1].type).toBe("circle");
    });

    it("should handle push/pop at root level", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.push();
        p.fill("blue");
        p.circle(10, 10, 5);
        p.pop();
        p.circle(20, 20, 5); // Back to root
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root { blue { circle }, circle }
      expect(frame.root.children).toHaveLength(2);

      const blueMat = frame.root.children[0] as ChildMaterial;
      expect(blueMat.fill).toBe("blue");
      expect(blueMat.children[0].type).toBe("circle");

      // Second circle directly under root
      expect(frame.root.children[1].type).toBe("circle");
    });
  });

  describe("Style inheritance via refs", () => {
    it("should have ref pointing to parent material ID", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.circle(10, 10, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const child = frame.root.children[0] as ChildMaterial;
      expect(child.ref).toBe("root");
    });

    it("should have deeply nested refs pointing to immediate parent", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.fill("blue");
        p.fill("green");
        p.circle(10, 10, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const redMat = frame.root.children[0] as ChildMaterial;
      expect(redMat.ref).toBe("root");

      const blueMat = redMat.children[0] as ChildMaterial;
      expect(blueMat.ref).toBe(redMat.id);

      const greenMat = blueMat.children[0] as ChildMaterial;
      expect(greenMat.ref).toBe(blueMat.id);
    });

    it("should only include the property that was set in ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("blue");
        p.circle(10, 10, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const child = frame.root.children[0] as ChildMaterial;
      expect(child.fill).toBe("blue");
      // stroke and strokeWidth should be undefined (inherited from parent)
      expect(child.stroke).toBeUndefined();
      expect(child.strokeWidth).toBeUndefined();
    });
  });

  describe("Sketch interface for push/pop", () => {
    it("should provide push function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof (p as unknown as { push: unknown }).push).toBe(
          "function"
        );
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });

    it("should provide pop function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof (p as unknown as { pop: unknown }).pop).toBe("function");
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });
  });
});

describe("Transform output - Naive IR", () => {
  describe("translate()", () => {
    it("should wrap subsequent shapes in Transform node", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(10, 20);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Transform contains circle directly (no style applied)
      const transformNode = frame.root.children[0] as Transform;
      expect(transformNode.type).toBe("transform");
      expect(transformNode.matrix).toEqual([1, 0, 0, 1, 10, 20]);
      expect(transformNode.children[0].type).toBe("circle");
    });

    it("should not create Transform node when no transforms applied", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.circle(10, 10, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Shape directly under root, not wrapped in Transform
      expect(frame.root.children[0].type).toBe("circle");
    });

    it("should create NESTED Transform nodes for multiple translate() calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(10, 20);
        p.translate(5, 10);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Nested transforms: Transform(10,20) > Transform(5,10) > circle
      const outer = frame.root.children[0] as Transform;
      expect(outer.type).toBe("transform");
      expect(outer.matrix).toEqual([1, 0, 0, 1, 10, 20]);

      const inner = outer.children[0] as Transform;
      expect(inner.type).toBe("transform");
      expect(inner.matrix).toEqual([1, 0, 0, 1, 5, 10]);

      expect(inner.children[0].type).toBe("circle");
    });
  });

  describe("rotate()", () => {
    it("should wrap shape in Transform node with rotation matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.rotate(Math.PI / 2); // 90 degrees
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const transformNode = frame.root.children[0] as Transform;
      expect(transformNode.type).toBe("transform");
      // cos(90) ≈ 0, sin(90) = 1
      expect(transformNode.matrix[0]).toBeCloseTo(0);
      expect(transformNode.matrix[1]).toBeCloseTo(1);
      expect(transformNode.matrix[2]).toBeCloseTo(-1);
      expect(transformNode.matrix[3]).toBeCloseTo(0);
      expect(transformNode.matrix[4]).toBe(0);
      expect(transformNode.matrix[5]).toBe(0);
    });
  });

  describe("scale()", () => {
    it("should wrap shape in Transform node with uniform scale matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.scale(2);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const transformNode = frame.root.children[0] as Transform;
      expect(transformNode.type).toBe("transform");
      expect(transformNode.matrix).toEqual([2, 0, 0, 2, 0, 0]);
    });

    it("should wrap shape in Transform node with non-uniform scale matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.scale(2, 3);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const transformNode = frame.root.children[0] as Transform;
      expect(transformNode.type).toBe("transform");
      expect(transformNode.matrix).toEqual([2, 0, 0, 3, 0, 0]);
    });
  });

  describe("Combined transforms - Naive IR creates NESTED nodes", () => {
    it("should create nested Transform nodes for translate then scale", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(10, 20);
        p.scale(2);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Nested: Transform(translate) > Transform(scale) > circle
      const translateNode = frame.root.children[0] as Transform;
      expect(translateNode.matrix).toEqual([1, 0, 0, 1, 10, 20]);

      const scaleNode = translateNode.children[0] as Transform;
      expect(scaleNode.matrix).toEqual([2, 0, 0, 2, 0, 0]);

      expect(scaleNode.children[0].type).toBe("circle");
    });

    it("should create nested Transform nodes for scale then translate", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.scale(2);
        p.translate(10, 20);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Nested: Transform(scale) > Transform(translate) > circle
      const scaleNode = frame.root.children[0] as Transform;
      expect(scaleNode.matrix).toEqual([2, 0, 0, 2, 0, 0]);

      const translateNode = scaleNode.children[0] as Transform;
      expect(translateNode.matrix).toEqual([1, 0, 0, 1, 10, 20]);

      expect(translateNode.children[0].type).toBe("circle");
    });

    it("should create nested nodes for translate, rotate, scale", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(100, 0);
        p.rotate(Math.PI / 4);
        p.scale(0.5);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const t1 = frame.root.children[0] as Transform;
      expect(t1.matrix).toEqual([1, 0, 0, 1, 100, 0]);

      const t2 = t1.children[0] as Transform;
      // 45 degree rotation
      expect(t2.matrix[0]).toBeCloseTo(Math.cos(Math.PI / 4));

      const t3 = t2.children[0] as Transform;
      expect(t3.matrix).toEqual([0.5, 0, 0, 0.5, 0, 0]);

      expect(t3.children[0].type).toBe("circle");
    });
  });

  describe("Transform with push/pop", () => {
    it("should save and restore insertion point with push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(10, 0);
        p.push();
        p.translate(5, 0);
        p.circle(0, 0, 5);
        p.pop();
        p.circle(0, 0, 5); // Back to first translate level
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root > T(10,0) { T(5,0) { circle }, circle }
      const outerT = frame.root.children[0] as Transform;
      expect(outerT.matrix).toEqual([1, 0, 0, 1, 10, 0]);
      expect(outerT.children).toHaveLength(2);

      const innerT = outerT.children[0] as Transform;
      expect(innerT.matrix).toEqual([1, 0, 0, 1, 5, 0]);
      expect(innerT.children[0].type).toBe("circle");

      // Circle after pop goes back to outer transform
      expect(outerT.children[1].type).toBe("circle");
    });

    it("should allow independent transforms in nested push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.push();
        p.translate(100, 0);
        p.circle(0, 0, 5);
        p.pop();
        p.circle(0, 0, 5); // No transform - directly under root
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root { T(100,0) { circle }, circle }
      expect(frame.root.children).toHaveLength(2);

      const transform = frame.root.children[0] as Transform;
      expect(transform.matrix).toEqual([1, 0, 0, 1, 100, 0]);
      expect(transform.children[0].type).toBe("circle");

      // Second circle directly under root (no transform)
      expect(frame.root.children[1].type).toBe("circle");
    });
  });

  describe("Transform with style", () => {
    it("should nest transform inside material when style then transform", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.fill("red");
        p.translate(10, 20);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root > material(red) > transform > circle
      const mat = frame.root.children[0] as ChildMaterial;
      expect(mat.fill).toBe("red");

      const transform = mat.children[0] as Transform;
      expect(transform.matrix).toEqual([1, 0, 0, 1, 10, 20]);
      expect(transform.children[0].type).toBe("circle");
    });

    it("should nest material inside transform when transform then style", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.translate(10, 20);
        p.fill("red");
        p.circle(0, 0, 5);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      // Structure: root > transform > material(red) > circle
      const transform = frame.root.children[0] as Transform;
      expect(transform.matrix).toEqual([1, 0, 0, 1, 10, 20]);

      const mat = transform.children[0] as ChildMaterial;
      expect(mat.fill).toBe("red");
      expect(mat.children[0].type).toBe("circle");
    });
  });

  describe("Sketch interface for transforms", () => {
    it("should provide translate function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof p.translate).toBe("function");
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });

    it("should provide rotate function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof p.rotate).toBe("function");
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });

    it("should provide scale function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof p.scale).toBe("function");
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });
  });
});

describe("Image output", () => {
  describe("image() without crop", () => {
    it("should create image shape without crop property", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.image("https://example.com/test.png", 10, 20, 100, 50);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const imageShape = frame.root.children[0] as {
        type: string;
        url: string;
        position: { x: number; y: number };
        width: number;
        height: number;
        crop?: { x: number; y: number; width: number; height: number };
      };

      expect(imageShape.type).toBe("image");
      expect(imageShape.url).toBe("https://example.com/test.png");
      expect(imageShape.position).toEqual({ x: 10, y: 20 });
      expect(imageShape.width).toBe(100);
      expect(imageShape.height).toBe(50);
      expect(imageShape.crop).toBeUndefined();
    });
  });

  describe("image() with crop parameters", () => {
    it("should create image shape with crop property when all crop params provided", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        p.image(
          "https://example.com/sprite.png",
          0,
          0,
          32,
          32,
          64,
          128,
          32,
          32
        );
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const imageShape = frame.root.children[0] as {
        type: string;
        url: string;
        position: { x: number; y: number };
        width: number;
        height: number;
        crop?: { x: number; y: number; width: number; height: number };
      };

      expect(imageShape.type).toBe("image");
      expect(imageShape.url).toBe("https://example.com/sprite.png");
      expect(imageShape.position).toEqual({ x: 0, y: 0 });
      expect(imageShape.width).toBe(32);
      expect(imageShape.height).toBe(32);
      expect(imageShape.crop).toEqual({ x: 64, y: 128, width: 32, height: 32 });
    });

    it("should not include crop when only some crop params provided", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        // Only providing cropX and cropY, not cropWidth and cropHeight
        p.image("https://example.com/test.png", 10, 20, 100, 50, 0, 0);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const imageShape = frame.root.children[0] as {
        type: string;
        crop?: { x: number; y: number; width: number; height: number };
      };

      expect(imageShape.type).toBe("image");
      expect(imageShape.crop).toBeUndefined();
    });

    it("should handle zero values for crop parameters correctly", () => {
      const generator = new ProceduralGenerator((p) => {
        p.viewport(50, 50);
        // All crop params are 0 (which is valid - top-left corner with 0x0 region)
        p.image("https://example.com/test.png", 10, 20, 100, 50, 0, 0, 0, 0);
      });
      const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

      const imageShape = frame.root.children[0] as {
        type: string;
        crop?: { x: number; y: number; width: number; height: number };
      };

      expect(imageShape.type).toBe("image");
      // Zero is a valid value (not undefined), so crop should be included
      expect(imageShape.crop).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe("Sketch interface for image", () => {
    it("should provide image function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        p.viewport(50, 50);
        expect(typeof p.image).toBe("function");
      });
      generator.frame({ time: 0, targetDimensions: [100, 100] });
    });
  });
});
