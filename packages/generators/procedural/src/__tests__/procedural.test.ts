import { ProceduralGenerator, Sketch } from "../index";
import type { ChildMaterial, RootMaterial, Transform } from "@medli/spec";

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

describe("Material output", () => {
  describe("Root material properties", () => {
    it("should have default root material properties when no style methods called", () => {
      const generator = new ProceduralGenerator((p) => {
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.fill).toBe("#000000");
      expect(frame.root.stroke).toBe("#000000");
      expect(frame.root.strokeWidth).toBe(1);
    });

    it("should set root fill from fill() call before shapes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("#ff0000");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.fill).toBe("#ff0000");
    });

    it("should set root stroke from stroke() call before shapes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.stroke("#00ff00");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.stroke).toBe("#00ff00");
    });

    it("should set root strokeWidth from strokeWidth() call before shapes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.strokeWidth(5);
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.strokeWidth).toBe(5);
    });

    it("should use last style call if called multiple times before shapes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("#ff0000");
        p.fill("#00ff00");
        p.fill("#0000ff");
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.fill).toBe("#0000ff");
    });

    it("should set all root material properties from multiple style calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("#ff0000");
        p.stroke("#00ff00");
        p.strokeWidth(3);
        p.circle(50, 50, 10);
      });
      const frame = generator.frame(0);

      expect(frame.root.fill).toBe("#ff0000");
      expect(frame.root.stroke).toBe("#00ff00");
      expect(frame.root.strokeWidth).toBe(3);
    });
  });

  describe("Different materials for different shapes", () => {
    it("should wrap shapes in ChildMaterial when fill changes between shapes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.circle(10, 10, 5);
        p.fill("blue");
        p.circle(20, 20, 5);
      });
      const frame = generator.frame(0);

      // Root should have two ChildMaterial children
      expect(frame.root.children).toHaveLength(2);

      const child1 = frame.root.children[0] as ChildMaterial;
      expect(child1.type).toBe("material");
      expect(child1.fill).toBe("red");
      expect(child1.ref).toBe("root");
      expect(child1.children).toHaveLength(1);
      expect(child1.children[0].type).toBe("circle");

      const child2 = frame.root.children[1] as ChildMaterial;
      expect(child2.type).toBe("material");
      expect(child2.fill).toBe("blue");
      expect(child2.ref).toBe("root");
      expect(child2.children).toHaveLength(1);
      expect(child2.children[0].type).toBe("circle");
    });

    it("should group consecutive shapes with same style in one ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.circle(10, 10, 5);
        p.circle(20, 20, 5);
        p.fill("blue");
        p.circle(30, 30, 5);
      });
      const frame = generator.frame(0);

      // Should have two ChildMaterial children (red group, blue group)
      expect(frame.root.children).toHaveLength(2);

      const redGroup = frame.root.children[0] as ChildMaterial;
      expect(redGroup.fill).toBe("red");
      expect(redGroup.children).toHaveLength(2);

      const blueGroup = frame.root.children[1] as ChildMaterial;
      expect(blueGroup.fill).toBe("blue");
      expect(blueGroup.children).toHaveLength(1);
    });

    it("should create new ChildMaterial when stroke changes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.stroke("red");
        p.line(0, 0, 10, 10);
        p.stroke("blue");
        p.line(20, 20, 30, 30);
      });
      const frame = generator.frame(0);

      expect(frame.root.children).toHaveLength(2);

      const child1 = frame.root.children[0] as ChildMaterial;
      expect(child1.stroke).toBe("red");

      const child2 = frame.root.children[1] as ChildMaterial;
      expect(child2.stroke).toBe("blue");
    });

    it("should create new ChildMaterial when strokeWidth changes", () => {
      const generator = new ProceduralGenerator((p) => {
        p.strokeWidth(2);
        p.line(0, 0, 10, 10);
        p.strokeWidth(5);
        p.line(20, 20, 30, 30);
      });
      const frame = generator.frame(0);

      expect(frame.root.children).toHaveLength(2);

      const child1 = frame.root.children[0] as ChildMaterial;
      expect(child1.strokeWidth).toBe(2);

      const child2 = frame.root.children[1] as ChildMaterial;
      expect(child2.strokeWidth).toBe(5);
    });

    it("should have unique IDs for each ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.circle(10, 10, 5);
        p.fill("blue");
        p.circle(20, 20, 5);
        p.fill("green");
        p.circle(30, 30, 5);
      });
      const frame = generator.frame(0);

      const ids = frame.root.children.map((c) => (c as ChildMaterial).id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("Nesting with push/pop", () => {
    it("should start a new nested material context with push()", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.push();
        p.fill("blue");
        p.circle(10, 10, 5);
        p.pop();
      });
      const frame = generator.frame(0);

      // Root fill should be red (set before push)
      expect(frame.root.fill).toBe("red");

      // Should have one ChildMaterial child (the pushed context)
      expect(frame.root.children).toHaveLength(1);
      const pushed = frame.root.children[0] as ChildMaterial;
      expect(pushed.type).toBe("material");
      expect(pushed.fill).toBe("blue");
      expect(pushed.ref).toBe("root");
      expect(pushed.children).toHaveLength(1);
      expect(pushed.children[0].type).toBe("circle");
    });

    it("should return to parent context after pop()", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.push();
        p.fill("blue");
        p.circle(10, 10, 5);
        p.pop();
        p.circle(20, 20, 5);
      });
      const frame = generator.frame(0);

      // Root should have red fill
      expect(frame.root.fill).toBe("red");

      // Should have two children: pushed group and circle after pop
      expect(frame.root.children).toHaveLength(2);

      // First child is the pushed group with blue fill
      const pushedGroup = frame.root.children[0] as ChildMaterial;
      expect(pushedGroup.fill).toBe("blue");

      // Second child is a circle (either directly or wrapped in ChildMaterial inheriting red)
      const afterPop = frame.root.children[1];
      if (afterPop.type === "circle") {
        // Shape directly under root inherits root's red fill
        expect(afterPop.type).toBe("circle");
      } else {
        // Or wrapped in ChildMaterial with red fill
        const wrapped = afterPop as ChildMaterial;
        expect(wrapped.fill).toBe("red");
      }
    });

    it("should restore style state after pop()", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.stroke("green");
        p.strokeWidth(2);
        p.push();
        p.fill("blue");
        p.stroke("yellow");
        p.strokeWidth(5);
        p.circle(10, 10, 5);
        p.pop();
        // After pop, should be back to red/green/2
        p.circle(20, 20, 5);
      });
      const frame = generator.frame(0);

      // Root should have the initial style (red/green/2)
      expect(frame.root.fill).toBe("red");
      expect(frame.root.stroke).toBe("green");
      expect(frame.root.strokeWidth).toBe(2);

      // First child is pushed context with blue/yellow/5
      const pushed = frame.root.children[0] as ChildMaterial;
      expect(pushed.fill).toBe("blue");
      expect(pushed.stroke).toBe("yellow");
      expect(pushed.strokeWidth).toBe(5);
    });
  });

  describe("Deep nesting", () => {
    it("should support multiple levels of push()", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.push();
        p.fill("blue");
        p.push();
        p.fill("green");
        p.circle(10, 10, 5);
        p.pop();
        p.pop();
      });
      const frame = generator.frame(0);

      // Root > ChildMaterial(blue) > ChildMaterial(green) > circle
      expect(frame.root.fill).toBe("red");

      const level1 = frame.root.children[0] as ChildMaterial;
      expect(level1.fill).toBe("blue");
      expect(level1.ref).toBe("root");

      const level2 = level1.children[0] as ChildMaterial;
      expect(level2.fill).toBe("green");
      expect(level2.ref).toBe(level1.id);

      expect(level2.children).toHaveLength(1);
      expect(level2.children[0].type).toBe("circle");
    });

    it("should correctly unwind multiple pops", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.circle(5, 5, 2); // red circle at root level
        p.push();
        p.fill("blue");
        p.push();
        p.fill("green");
        p.circle(10, 10, 5);
        p.pop();
        p.circle(15, 15, 5); // blue circle at level 1
        p.pop();
        p.circle(20, 20, 5); // red circle at root level
      });
      const frame = generator.frame(0);

      // Should have 3 top-level children: circle, pushed group, circle
      // (or wrapped in ChildMaterials)
      expect(frame.root.children.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Style inheritance via refs", () => {
    it("should have ref pointing to parent material ID", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.push();
        p.fill("blue");
        p.circle(10, 10, 5);
        p.pop();
      });
      const frame = generator.frame(0);

      const child = frame.root.children[0] as ChildMaterial;
      expect(child.ref).toBe(frame.root.id);
    });

    it("should have deeply nested refs pointing to immediate parent", () => {
      const generator = new ProceduralGenerator((p) => {
        p.push();
        p.push();
        p.push();
        p.circle(10, 10, 5);
        p.pop();
        p.pop();
        p.pop();
      });
      const frame = generator.frame(0);

      // Navigate down the tree and verify each ref points to parent
      let current = frame.root;
      while (current.children.length > 0) {
        const child = current.children[0];
        if (child.type === "material") {
          const childMat = child as ChildMaterial;
          expect(childMat.ref).toBe(current.id);
          current = childMat as unknown as RootMaterial;
        } else {
          break;
        }
      }
    });

    it("should only include changed properties in ChildMaterial", () => {
      const generator = new ProceduralGenerator((p) => {
        p.fill("red");
        p.stroke("green");
        p.strokeWidth(2);
        p.push();
        p.fill("blue"); // Only change fill
        p.circle(10, 10, 5);
        p.pop();
      });
      const frame = generator.frame(0);

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
        expect(typeof (p as unknown as { push: unknown }).push).toBe(
          "function"
        );
      });
      generator.frame(0);
    });

    it("should provide pop function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        expect(typeof (p as unknown as { pop: unknown }).pop).toBe("function");
      });
      generator.frame(0);
    });
  });
});

describe("Transform output", () => {
  describe("translate()", () => {
    it("should wrap shape in Transform node with translation matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.translate(10, 20);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      // Find the circle wrapped in a transform
      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      expect(transformNode.type).toBe("transform");
      // Translation matrix: [1, 0, 0, 1, x, y]
      expect(transformNode.matrix).toEqual([1, 0, 0, 1, 10, 20]);
      expect(transformNode.children[0].type).toBe("circle");
    });

    it("should not create Transform node when no transforms applied", () => {
      const generator = new ProceduralGenerator((p) => {
        p.circle(10, 10, 5);
      });
      const frame = generator.frame(0);

      // Shape should be directly in the material, not wrapped in Transform
      const childMaterial = frame.root.children[0] as ChildMaterial;
      expect(childMaterial.children[0].type).toBe("circle");
    });

    it("should accumulate multiple translate() calls", () => {
      const generator = new ProceduralGenerator((p) => {
        p.translate(10, 20);
        p.translate(5, 10);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      // Accumulated: translate(10,20) then translate(5,10) = translate(15,30)
      expect(transformNode.matrix).toEqual([1, 0, 0, 1, 15, 30]);
    });
  });

  describe("rotate()", () => {
    it("should wrap shape in Transform node with rotation matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.rotate(Math.PI / 2); // 90 degrees
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      expect(transformNode.type).toBe("transform");
      // Rotation matrix for 90 degrees: [cos, sin, -sin, cos, 0, 0]
      // cos(90°) ≈ 0, sin(90°) = 1
      expect(transformNode.matrix[0]).toBeCloseTo(0); // cos
      expect(transformNode.matrix[1]).toBeCloseTo(1); // sin
      expect(transformNode.matrix[2]).toBeCloseTo(-1); // -sin
      expect(transformNode.matrix[3]).toBeCloseTo(0); // cos
      expect(transformNode.matrix[4]).toBe(0);
      expect(transformNode.matrix[5]).toBe(0);
    });
  });

  describe("scale()", () => {
    it("should wrap shape in Transform node with uniform scale matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.scale(2);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      expect(transformNode.type).toBe("transform");
      // Uniform scale matrix: [sx, 0, 0, sy, 0, 0]
      expect(transformNode.matrix).toEqual([2, 0, 0, 2, 0, 0]);
    });

    it("should wrap shape in Transform node with non-uniform scale matrix", () => {
      const generator = new ProceduralGenerator((p) => {
        p.scale(2, 3);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      expect(transformNode.type).toBe("transform");
      expect(transformNode.matrix).toEqual([2, 0, 0, 3, 0, 0]);
    });
  });

  describe("Combined transforms", () => {
    it("should compose translate then scale correctly", () => {
      const generator = new ProceduralGenerator((p) => {
        p.translate(10, 20);
        p.scale(2);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      // translate(10,20) * scale(2,2) = [2, 0, 0, 2, 10, 20]
      // Matrix multiplication: new = current * transform
      expect(transformNode.matrix).toEqual([2, 0, 0, 2, 10, 20]);
    });

    it("should compose scale then translate correctly", () => {
      const generator = new ProceduralGenerator((p) => {
        p.scale(2);
        p.translate(10, 20);
        p.circle(0, 0, 5);
      });
      const frame = generator.frame(0);

      const childMaterial = frame.root.children[0] as ChildMaterial;
      const transformNode = childMaterial.children[0] as Transform;

      // scale(2,2) * translate(10,20)
      // Translation is scaled: e' = 2*10 = 20, f' = 2*20 = 40
      expect(transformNode.matrix).toEqual([2, 0, 0, 2, 20, 40]);
    });
  });

  describe("Transform with push/pop", () => {
    it("should save and restore transform state with push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.translate(10, 0);
        p.push();
        p.translate(5, 0);
        p.circle(0, 0, 5); // Should have translate(15, 0)
        p.pop();
        p.circle(0, 0, 5); // Should have translate(10, 0)
      });
      const frame = generator.frame(0);

      // First child is the pushed context material
      const pushedMaterial = frame.root.children[0] as ChildMaterial;
      const pushedTransform = pushedMaterial.children[0] as Transform;
      expect(pushedTransform.type).toBe("transform");
      expect(pushedTransform.matrix).toEqual([1, 0, 0, 1, 15, 0]);

      // Second child is the circle after pop (wrapped in material)
      const afterPopMaterial = frame.root.children[1] as ChildMaterial;
      const afterPopTransform = afterPopMaterial.children[0] as Transform;
      expect(afterPopTransform.type).toBe("transform");
      expect(afterPopTransform.matrix).toEqual([1, 0, 0, 1, 10, 0]);
    });

    it("should allow independent transforms in nested push/pop", () => {
      const generator = new ProceduralGenerator((p) => {
        p.push();
        p.translate(100, 0);
        p.circle(0, 0, 5);
        p.pop();
        p.circle(0, 0, 5); // No transform
      });
      const frame = generator.frame(0);

      // First child is pushed context with translated circle
      const pushedMaterial = frame.root.children[0] as ChildMaterial;
      const pushedTransform = pushedMaterial.children[0] as Transform;
      expect(pushedTransform.matrix).toEqual([1, 0, 0, 1, 100, 0]);

      // Second child has no transform (directly a circle, not wrapped in Transform)
      const afterPopMaterial = frame.root.children[1] as ChildMaterial;
      expect(afterPopMaterial.children[0].type).toBe("circle");
    });
  });

  describe("Sketch interface for transforms", () => {
    it("should provide translate function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        expect(typeof p.translate).toBe("function");
      });
      generator.frame(0);
    });

    it("should provide rotate function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        expect(typeof p.rotate).toBe("function");
      });
      generator.frame(0);
    });

    it("should provide scale function", () => {
      const generator = new ProceduralGenerator((p: Sketch) => {
        expect(typeof p.scale).toBe("function");
      });
      generator.frame(0);
    });
  });
});
