import { Scene, FragmentScene, Circle, Material, Group, Line } from "../index";
import type {
  ChildMaterial,
  Fragment,
  RootMaterialRef,
  RenderContext,
  FrameNode,
} from "@medli/spec";
import { validateFragment, validateFrame } from "@medli/spec";

const defaultViewport = {
  halfWidth: 50,
  halfHeight: 50,
  scaleMode: "fit" as const,
};

const defaultContext: RenderContext = {
  time: 0,
  targetDimensions: [100, 100],
};

describe("FragmentScene", () => {
  describe("produces valid fragments", () => {
    it("should produce a fragment with RootMaterialRef", () => {
      const fragmentScene = new FragmentScene();
      const fragment = fragmentScene.fragment(defaultContext);

      expect(fragment.root.type).toBe("root-material-ref");
      expect(fragment.root.id).toBe("scene_root");
      expect(Array.isArray(fragment.root.children)).toBe(true);
    });

    it("should produce a valid empty fragment", () => {
      const fragmentScene = new FragmentScene();
      const fragment = fragmentScene.fragment(defaultContext);

      const result = validateFragment(fragment);
      expect(result.valid).toBe(true);
    });

    it("should produce a valid fragment with shapes", () => {
      const fragmentScene = new FragmentScene();
      fragmentScene.add(new Circle(0, 0, 10));

      const fragment = fragmentScene.fragment(defaultContext);

      const result = validateFragment(fragment);
      expect(result.valid).toBe(true);
      expect(fragment.root.children.length).toBe(1);
      expect(fragment.root.children[0]).toEqual({
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 10,
      });
    });

    it("should produce a valid fragment with materials", () => {
      const fragmentScene = new FragmentScene();
      const material = new Material({ fill: "#ff0000" });
      const circle = new Circle(0, 0, 10);
      circle.material = material;

      fragmentScene.add(material);
      fragmentScene.add(circle);

      const fragment = fragmentScene.fragment(defaultContext);

      const result = validateFragment(fragment);
      expect(result.valid).toBe(true);

      // Material should ref scene_root
      const childMaterial = fragment.root.children[0] as ChildMaterial;
      expect(childMaterial.type).toBe("material");
      expect(childMaterial.ref).toBe("scene_root");
      expect(childMaterial.fill).toBe("#ff0000");
    });
  });

  describe("add() works like Scene.add()", () => {
    it("should add children and support method chaining", () => {
      const fragmentScene = new FragmentScene();
      const circle = new Circle(10, 10, 5);

      const result = fragmentScene.add(circle);

      expect(result).toBe(fragmentScene);
      expect(fragmentScene.getChildren()).toContain(circle);
    });

    it("should add multiple children", () => {
      const fragmentScene = new FragmentScene();
      const circle1 = new Circle(10, 10, 5);
      const circle2 = new Circle(20, 20, 5);

      fragmentScene.add(circle1).add(circle2);

      expect(fragmentScene.getChildren().length).toBe(2);
    });
  });

  describe("remove() works like Scene.remove()", () => {
    it("should remove children and support method chaining", () => {
      const fragmentScene = new FragmentScene();
      const circle = new Circle(10, 10, 5);

      fragmentScene.add(circle);
      const result = fragmentScene.remove(circle);

      expect(result).toBe(fragmentScene);
      expect(fragmentScene.getChildren()).not.toContain(circle);
    });
  });

  describe("Groups in FragmentScene", () => {
    it("should support Groups with transforms", () => {
      const fragmentScene = new FragmentScene();
      const group = new Group();
      group.position = { x: 50, y: 50 };
      group.add(new Circle(0, 0, 10));

      fragmentScene.add(group);

      const fragment = fragmentScene.fragment(defaultContext);

      expect(fragment.root.children.length).toBe(1);
      const transform = fragment.root.children[0] as { type: string };
      expect(transform.type).toBe("transform");
    });
  });
});

describe("Scene.embed()", () => {
  describe("adds Embed node", () => {
    it("should embed a Fragment and resolve it", () => {
      const scene = new Scene(defaultViewport);
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "circle",
              center: { x: 0, y: 0 },
              radius: 5,
            },
          ],
        },
      };

      scene.embed(fragment, "ns1");

      const frame = scene.frame(defaultContext);

      // Embed should be resolved - fragment contents should be in root.children
      expect(frame.root.children.length).toBe(1);
      expect(frame.root.children[0]).toEqual({
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 5,
      });
    });

    it("should support method chaining", () => {
      const scene = new Scene(defaultViewport);
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [],
        },
      };

      const result = scene.embed(fragment, "ns1");
      expect(result).toBe(scene);
    });
  });

  describe("with FragmentGenerator calls fragment()", () => {
    it("should call fragment() on FragmentGenerator", () => {
      const scene = new Scene(defaultViewport);
      const fragmentScene = new FragmentScene();
      fragmentScene.add(new Circle(0, 0, 10));

      scene.embed(fragmentScene, "ns1");

      const frame = scene.frame(defaultContext);

      // Fragment content should be resolved into the frame
      expect(frame.root.children.length).toBe(1);
      expect((frame.root.children[0] as { type: string }).type).toBe("circle");
    });
  });

  describe("with Fragment uses directly", () => {
    it("should use Fragment directly without calling fragment()", () => {
      const scene = new Scene(defaultViewport);
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "line",
              start: { x: 0, y: 0 },
              end: { x: 10, y: 10 },
            },
          ],
        },
      };

      scene.embed(fragment, "ns1");

      const frame = scene.frame(defaultContext);

      expect(frame.root.children[0]).toEqual({
        type: "line",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
      });
    });
  });

  describe("material namespacing", () => {
    it("should namespace material IDs from fragment", () => {
      const scene = new Scene(defaultViewport);
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "mat1",
              ref: "frag_root",
              fill: "#ff0000",
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

      scene.embed(fragment, "ns1");

      const frame = scene.frame(defaultContext);

      // Material should be namespaced
      const childMat = frame.root.children[0] as ChildMaterial;
      expect(childMat.type).toBe("material");
      expect(childMat.id).toBe("ns1_mat1");
      expect(childMat.ref).toBe("root"); // frag_root -> root (embedding context)
    });
  });

  describe("custom rootMaterialId", () => {
    it("should default rootMaterialId to 'root'", () => {
      const scene = new Scene(defaultViewport);

      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "mat1",
              ref: "frag_root",
              stroke: "#0000ff",
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

      scene.embed(fragment, "ns1"); // default rootMaterialId is "root"

      const frame = scene.frame(defaultContext);

      // The embedded material should ref root (the default)
      const embeddedMat = frame.root.children[0] as ChildMaterial;
      expect(embeddedMat.id).toBe("ns1_mat1");
      expect(embeddedMat.ref).toBe("root"); // frag_root -> root
    });
  });
});

describe("Group.embedFragment()", () => {
  describe("adds nested Embed", () => {
    it("should embed fragment in Group", () => {
      const scene = new Scene(defaultViewport);
      const group = new Group();
      group.position = { x: 50, y: 50 };

      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "circle",
              center: { x: 0, y: 0 },
              radius: 5,
            },
          ],
        },
      };

      group.embedFragment(fragment, "ns1");
      scene.add(group);

      const frame = scene.frame(defaultContext);

      // Group should contain transform with embedded content
      const transform = frame.root.children[0] as {
        type: string;
        children: FrameNode[];
      };
      expect(transform.type).toBe("transform");
      expect(transform.children.length).toBe(1);
      expect((transform.children[0] as { type: string }).type).toBe("circle");
    });

    it("should support method chaining", () => {
      const group = new Group();
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [],
        },
      };

      const result = group.embedFragment(fragment, "ns1");
      expect(result).toBe(group);
    });
  });
});

describe("Full integration", () => {
  describe("embed FragmentScene into Scene", () => {
    it("should compose FragmentScene into Scene", () => {
      const fragmentScene = new FragmentScene();
      const fragMaterial = new Material({ fill: "#ff0000" });
      const fragCircle = new Circle(0, 0, 10);
      fragCircle.material = fragMaterial;
      fragmentScene.add(fragMaterial);
      fragmentScene.add(fragCircle);

      const scene = new Scene(defaultViewport);
      scene.embed(fragmentScene, "frag1");

      const frame = scene.frame(defaultContext);

      // Validate the frame is valid
      const result = validateFrame(frame);
      expect(result.valid).toBe(true);

      // Fragment content should be resolved
      expect(frame.root.children.length).toBe(1);
      const childMat = frame.root.children[0] as ChildMaterial;
      expect(childMat.type).toBe("material");
      expect(childMat.id).toMatch(/^frag1_/); // Namespaced
      expect(childMat.fill).toBe("#ff0000");
    });
  });

  describe("same FragmentScene embedded twice with different namespaces", () => {
    it("should embed same fragment multiple times with unique namespaces", () => {
      const fragmentScene = new FragmentScene();
      fragmentScene.add(new Circle(0, 0, 5));

      const scene = new Scene(defaultViewport);
      scene.embed(fragmentScene, "a");
      scene.embed(fragmentScene, "b");

      const frame = scene.frame(defaultContext);

      // Should have two circles (from two embeddings)
      expect(frame.root.children.length).toBe(2);
      expect((frame.root.children[0] as { type: string }).type).toBe("circle");
      expect((frame.root.children[1] as { type: string }).type).toBe("circle");
    });

    it("should namespace materials differently for each embedding", () => {
      const fragmentScene = new FragmentScene();
      const material = new Material({ fill: "#ff0000" });
      const circle = new Circle(0, 0, 5);
      circle.material = material;
      fragmentScene.add(material);
      fragmentScene.add(circle);

      const scene = new Scene(defaultViewport);
      scene.embed(fragmentScene, "left");
      scene.embed(fragmentScene, "right");

      const frame = scene.frame(defaultContext);

      // Should have two materials with different namespaced IDs
      expect(frame.root.children.length).toBe(2);
      const mat1 = frame.root.children[0] as ChildMaterial;
      const mat2 = frame.root.children[1] as ChildMaterial;
      expect(mat1.type).toBe("material");
      expect(mat2.type).toBe("material");
      expect(mat1.id).toMatch(/^left_/);
      expect(mat2.id).toMatch(/^right_/);
      expect(mat1.id).not.toBe(mat2.id);
    });
  });

  describe("material inheritance from embedding context", () => {
    it("should inherit styles from embedding material", () => {
      // Create a fragment with a shape that uses the fragment's root material ref
      const fragmentScene = new FragmentScene();
      fragmentScene.add(new Circle(0, 0, 10)); // Uses scene_root (fragment's root)

      // Create scene with a material for embedding context
      const scene = new Scene(defaultViewport);
      scene.fill = "#00ff00"; // Scene's root material fill

      scene.embed(fragmentScene, "ns1");

      const frame = scene.frame(defaultContext);

      // The circle should inherit from root (which has fill #00ff00)
      // This is verified by the frame structure - circle is under root
      expect(frame.root.fill).toBe("#00ff00");
      expect(frame.root.children[0]).toEqual({
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 10,
      });
    });

    it("should allow fragment materials to override root styles", () => {
      // Fragment with material that overrides styles
      const fragmentScene = new FragmentScene();
      const fragMaterial = new Material({ stroke: "#0000ff" });
      const circle = new Circle(0, 0, 10);
      circle.material = fragMaterial;
      fragmentScene.add(fragMaterial);
      fragmentScene.add(circle);

      // Scene with default root material
      const scene = new Scene(defaultViewport);
      scene.fill = "#ff0000"; // Root fill
      scene.embed(fragmentScene, "ns1"); // Embeds at root

      const frame = scene.frame(defaultContext);
      const result = validateFrame(frame);
      expect(result.valid).toBe(true);

      // Fragment material should ref root and have its stroke override
      const fragMat = frame.root.children[0] as ChildMaterial;
      expect(fragMat.ref).toBe("root");
      expect(fragMat.stroke).toBe("#0000ff");
      // Fill is inherited from root (#ff0000)
    });
  });
});

describe("Edge cases", () => {
  it("should handle empty fragment", () => {
    const scene = new Scene(defaultViewport);
    const fragment: Fragment = {
      root: {
        type: "root-material-ref",
        id: "empty",
        children: [],
      },
    };

    scene.embed(fragment, "ns1");

    const frame = scene.frame(defaultContext);
    expect(frame.root.children.length).toBe(0);
  });

  it("should handle fragment with nested materials", () => {
    const fragmentScene = new FragmentScene();
    const outerMat = new Material({ fill: "#ff0000" });
    const innerMat = new Material({ stroke: "#00ff00" });
    innerMat.parent = outerMat;

    const circle = new Circle(0, 0, 5);
    circle.material = innerMat;

    fragmentScene.add(outerMat);
    fragmentScene.add(innerMat);
    fragmentScene.add(circle);

    const scene = new Scene(defaultViewport);
    scene.embed(fragmentScene, "ns1");

    const frame = scene.frame(defaultContext);
    const result = validateFrame(frame);
    expect(result.valid).toBe(true);
  });

  it("should handle multiple nested Groups in fragment", () => {
    const fragmentScene = new FragmentScene();
    const outer = new Group();
    outer.position = { x: 10, y: 10 };
    const inner = new Group();
    inner.position = { x: 5, y: 5 };
    inner.add(new Circle(0, 0, 2));
    outer.add(inner);
    fragmentScene.add(outer);

    const scene = new Scene(defaultViewport);
    scene.embed(fragmentScene, "ns1");

    const frame = scene.frame(defaultContext);
    const result = validateFrame(frame);
    expect(result.valid).toBe(true);
  });
});
