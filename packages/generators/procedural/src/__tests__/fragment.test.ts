import { ProceduralGenerator } from "../index";
import type {
  ChildMaterial,
  Transform,
  Circle,
  Fragment,
  FragmentGenerator,
  RenderContext,
} from "@medli/spec";

describe("embed()", () => {
  const createSimpleFragment = (): Fragment => ({
    root: {
      type: "root-material-ref",
      id: "fragment_root",
      children: [
        {
          type: "circle",
          center: { x: 0, y: 0 },
          radius: 5,
        },
      ],
    },
  });

  it("should add Embed node to tree (which gets resolved)", () => {
    const fragment = createSimpleFragment();

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.embed(fragment, "frag1");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // After resolution, the fragment's circle should be directly under root
    expect(frame.root.children).toHaveLength(1);
    expect(frame.root.children[0].type).toBe("circle");
  });

  it("should use current material as rootMaterialId", () => {
    // Create a fragment with a ChildMaterial that refs the root
    const fragment: Fragment = {
      root: {
        type: "root-material-ref",
        id: "fragment_root",
        children: [
          {
            type: "material",
            id: "frag_mat",
            ref: "fragment_root",
            fill: "blue",
            children: [
              {
                type: "circle",
                center: { x: 0, y: 0 },
                radius: 5,
              },
            ],
          },
        ],
      },
    };

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.fill("red");
      p.embed(fragment, "frag1");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // After resolution, the fragment's material should ref the parent material (m1)
    const redMat = frame.root.children[0] as ChildMaterial;
    expect(redMat.fill).toBe("red");

    // The fragment's material should now reference the red material
    const fragMat = redMat.children[0] as ChildMaterial;
    expect(fragMat.id).toBe("frag1_frag_mat");
    expect(fragMat.ref).toBe(redMat.id); // Should reference the parent material
    expect(fragMat.fill).toBe("blue");
  });

  it("should call fragment() when given FragmentGenerator", () => {
    let fragmentCalled = false;

    const fragmentGen: FragmentGenerator = {
      fragment(context: RenderContext): Fragment {
        fragmentCalled = true;
        expect(context.time).toBe(42);
        expect(context.targetDimensions).toEqual([100, 100]);
        return createSimpleFragment();
      },
    };

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.embed(fragmentGen, "frag1");
    });

    generator.frame({ time: 42, targetDimensions: [100, 100] });

    expect(fragmentCalled).toBe(true);
  });

  it("should use Fragment directly when given Fragment", () => {
    const fragment = createSimpleFragment();

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.embed(fragment, "frag1");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // Circle should be embedded
    expect(frame.root.children).toHaveLength(1);
    expect(frame.root.children[0].type).toBe("circle");
  });

  it("should embed same fragment twice with different namespaces", () => {
    const fragment: Fragment = {
      root: {
        type: "root-material-ref",
        id: "fragment_root",
        children: [
          {
            type: "material",
            id: "mat",
            ref: "fragment_root",
            fill: "green",
            children: [
              {
                type: "circle",
                center: { x: 0, y: 0 },
                radius: 5,
              },
            ],
          },
        ],
      },
    };

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.embed(fragment, "first");
      p.embed(fragment, "second");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // Both embeds should resolve to separate materials with namespaced IDs
    expect(frame.root.children).toHaveLength(2);

    const firstMat = frame.root.children[0] as ChildMaterial;
    expect(firstMat.id).toBe("first_mat");
    expect(firstMat.ref).toBe("root");

    const secondMat = frame.root.children[1] as ChildMaterial;
    expect(secondMat.id).toBe("second_mat");
    expect(secondMat.ref).toBe("root");
  });

  it("should work with transforms", () => {
    const fragment = createSimpleFragment();

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);
      p.translate(10, 20);
      p.embed(fragment, "frag1");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // Transform should contain the resolved fragment content
    const transform = frame.root.children[0] as Transform;
    expect(transform.type).toBe("transform");
    expect(transform.matrix).toEqual([1, 0, 0, 1, 10, 20]);
    expect(transform.children[0].type).toBe("circle");
  });
});

describe("createFragment()", () => {
  it("should capture drawing operations", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.circle(10, 20, 5);
      });

      expect(fragment.root.type).toBe("root-material-ref");
      expect(fragment.root.id).toBe("fragment_root");
      expect(fragment.root.children).toHaveLength(1);

      const circle = fragment.root.children[0] as Circle;
      expect(circle.type).toBe("circle");
      expect(circle.center).toEqual({ x: 10, y: 20 });
      expect(circle.radius).toBe(5);
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should throw on viewport()", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      expect(() => {
        p.createFragment((fp) => {
          fp.viewport(100, 100);
        });
      }).toThrow("viewport() cannot be called inside createFragment()");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should throw on background()", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      expect(() => {
        p.createFragment((fp) => {
          fp.background("red");
        });
      }).toThrow("background() cannot be called inside createFragment()");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should throw on scaleMode()", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      expect(() => {
        p.createFragment((fp) => {
          fp.scaleMode("fill");
        });
      }).toThrow("scaleMode() cannot be called inside createFragment()");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should return valid Fragment", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.fill("red");
        fp.circle(0, 0, 10);
      });

      // Validate fragment structure
      expect(fragment.root.type).toBe("root-material-ref");
      expect(fragment.root.id).toBe("fragment_root");
      expect(fragment.root.children.length).toBeGreaterThan(0);

      const material = fragment.root.children[0] as ChildMaterial;
      expect(material.type).toBe("material");
      expect(material.ref).toBe("fragment_root");
      expect(material.fill).toBe("red");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should support fill(), stroke(), strokeWidth()", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.fill("red");
        fp.stroke("blue");
        fp.strokeWidth(3);
        fp.circle(0, 0, 10);
      });

      // Three nested materials
      const fillMat = fragment.root.children[0] as ChildMaterial;
      expect(fillMat.fill).toBe("red");

      const strokeMat = fillMat.children[0] as ChildMaterial;
      expect(strokeMat.stroke).toBe("blue");

      const widthMat = strokeMat.children[0] as ChildMaterial;
      expect(widthMat.strokeWidth).toBe(3);
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should support push() and pop()", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.fill("red");
        fp.push();
        fp.fill("blue");
        fp.circle(0, 0, 5);
        fp.pop();
        fp.circle(10, 10, 5);
      });

      // Structure: root > red { blue { circle }, circle }
      const redMat = fragment.root.children[0] as ChildMaterial;
      expect(redMat.fill).toBe("red");
      expect(redMat.children).toHaveLength(2);

      const blueMat = redMat.children[0] as ChildMaterial;
      expect(blueMat.fill).toBe("blue");

      // Second circle back in red
      expect(redMat.children[1].type).toBe("circle");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should support transforms", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.translate(10, 20);
        fp.rotate(Math.PI / 2);
        fp.scale(2);
        fp.circle(0, 0, 5);
      });

      const t1 = fragment.root.children[0] as Transform;
      expect(t1.type).toBe("transform");
      expect(t1.matrix).toEqual([1, 0, 0, 1, 10, 20]);

      const t2 = t1.children[0] as Transform;
      expect(t2.type).toBe("transform");

      const t3 = t2.children[0] as Transform;
      expect(t3.type).toBe("transform");
      expect(t3.matrix).toEqual([2, 0, 0, 2, 0, 0]);
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should support all shape types", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const fragment = p.createFragment((fp) => {
        fp.circle(0, 0, 5);
        fp.rectangle(10, 10, 20, 15);
        fp.line(0, 0, 10, 10);
        fp.lineOffset(20, 20, 5, 5);
        fp.image("http://example.com/img.png", 0, 0, 50, 50);
      });

      expect(fragment.root.children).toHaveLength(5);
      expect(fragment.root.children[0].type).toBe("circle");
      expect(fragment.root.children[1].type).toBe("rectangle");
      expect(fragment.root.children[2].type).toBe("line");
      expect(fragment.root.children[3].type).toBe("line");
      expect(fragment.root.children[4].type).toBe("image");
    });

    generator.frame({ time: 0, targetDimensions: [100, 100] });
  });

  it("should have access to time and targetDimensions", () => {
    let capturedTime = -1;
    let capturedWidth = -1;
    let capturedHeight = -1;

    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      p.createFragment((fp) => {
        capturedTime = fp.time;
        capturedWidth = fp.targetWidth;
        capturedHeight = fp.targetHeight;
      });
    });

    generator.frame({ time: 1234, targetDimensions: [800, 600] });

    expect(capturedTime).toBe(1234);
    expect(capturedWidth).toBe(800);
    expect(capturedHeight).toBe(600);
  });
});

describe("Full integration", () => {
  it("should embed fragment and verify resolved output", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      // Create a fragment with some content
      const starFragment = p.createFragment((fp) => {
        fp.fill("yellow");
        fp.circle(0, 0, 10);
      });

      // Embed it with a red fill context
      p.fill("red");
      p.embed(starFragment, "star1");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // The resolved structure should be:
    // root > red { yellow { circle } }
    const redMat = frame.root.children[0] as ChildMaterial;
    expect(redMat.fill).toBe("red");

    const yellowMat = redMat.children[0] as ChildMaterial;
    expect(yellowMat.id).toBe("star1_fm1"); // namespaced
    expect(yellowMat.ref).toBe(redMat.id); // refs the red material
    expect(yellowMat.fill).toBe("yellow");

    const circle = yellowMat.children[0];
    expect(circle.type).toBe("circle");
  });

  it("should allow nested fragment embedding", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      // Create inner fragment
      const innerFragment = p.createFragment((fp) => {
        fp.circle(0, 0, 5);
      });

      // Create outer fragment that embeds inner
      const outerFragment = p.createFragment((fp) => {
        fp.fill("blue");
        fp.embed(innerFragment, "inner");
      });

      // Embed outer fragment
      p.embed(outerFragment, "outer");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // Structure: root > blue(outer_fm1) { circle }
    const blueMat = frame.root.children[0] as ChildMaterial;
    expect(blueMat.id).toBe("outer_fm1");
    expect(blueMat.fill).toBe("blue");

    // The inner fragment's circle should be resolved
    expect(blueMat.children[0].type).toBe("circle");
  });

  it("should maintain isolation between multiple createFragment calls", () => {
    const generator = new ProceduralGenerator((p) => {
      p.viewport(50, 50);

      const frag1 = p.createFragment((fp) => {
        fp.fill("red");
        fp.circle(0, 0, 5);
      });

      const frag2 = p.createFragment((fp) => {
        fp.fill("blue");
        fp.rectangle(0, 0, 10, 10);
      });

      p.embed(frag1, "f1");
      p.embed(frag2, "f2");
    });

    const frame = generator.frame({ time: 0, targetDimensions: [100, 100] });

    // Both fragments should be independent
    expect(frame.root.children).toHaveLength(2);

    const redMat = frame.root.children[0] as ChildMaterial;
    expect(redMat.id).toBe("f1_fm1");
    expect(redMat.fill).toBe("red");
    expect(redMat.children[0].type).toBe("circle");

    const blueMat = frame.root.children[1] as ChildMaterial;
    expect(blueMat.id).toBe("f2_fm1");
    expect(blueMat.fill).toBe("blue");
    expect(blueMat.children[0].type).toBe("rectangle");
  });
});
