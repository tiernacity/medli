import type {
  ChildMaterial,
  Embed,
  Fragment,
  FragmentGenerator,
  Frame,
  FrameNode,
  RenderContext,
  RootMaterialRef,
  Transform,
  UnresolvedFrameNode,
  Viewport,
} from "../index";
import {
  validateFragment,
  validateEmbed,
  resolveEmbed,
  resolveFrame,
  fragmentToFrame,
  validateFrame,
} from "../index";

describe("Fragment types", () => {
  describe("RootMaterialRef", () => {
    it("should allow creating a RootMaterialRef with empty children", () => {
      const ref: RootMaterialRef = {
        type: "root-material-ref",
        id: "fragment_root",
        children: [],
      };
      expect(ref.type).toBe("root-material-ref");
      expect(ref.id).toBe("fragment_root");
      expect(ref.children).toHaveLength(0);
    });

    it("should allow creating a RootMaterialRef with shape children", () => {
      const ref: RootMaterialRef = {
        type: "root-material-ref",
        id: "fragment_root",
        children: [
          {
            type: "circle",
            center: { x: 0, y: 0 },
            radius: 10,
          },
          {
            type: "rectangle",
            center: { x: 50, y: 50 },
            width: 20,
            height: 30,
          },
        ],
      };
      expect(ref.children).toHaveLength(2);
      expect(ref.children[0].type).toBe("circle");
      expect(ref.children[1].type).toBe("rectangle");
    });

    it("should allow creating a RootMaterialRef with nested materials", () => {
      const ref: RootMaterialRef = {
        type: "root-material-ref",
        id: "fragment_root",
        children: [
          {
            type: "material",
            id: "child_material",
            ref: "fragment_root",
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
      };
      expect(ref.children).toHaveLength(1);
      expect(ref.children[0].type).toBe("material");
    });

    it("should allow creating a RootMaterialRef with transforms", () => {
      const ref: RootMaterialRef = {
        type: "root-material-ref",
        id: "fragment_root",
        children: [
          {
            type: "transform",
            matrix: [1, 0, 0, 1, 10, 20],
            children: [
              {
                type: "line",
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
              },
            ],
          },
        ],
      };
      expect(ref.children).toHaveLength(1);
      expect(ref.children[0].type).toBe("transform");
    });
  });

  describe("Fragment", () => {
    it("should allow creating an empty Fragment", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "root",
          children: [],
        },
      };
      expect(fragment.root.type).toBe("root-material-ref");
      expect(fragment.root.children).toHaveLength(0);
    });

    it("should allow creating a Fragment with shapes", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "root",
          children: [
            {
              type: "circle",
              center: { x: 0, y: 0 },
              radius: 25,
            },
          ],
        },
      };
      expect(fragment.root.children).toHaveLength(1);
    });

    it("should allow creating a Fragment with complex tree structure", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "root",
          children: [
            {
              type: "material",
              id: "mat1",
              ref: "root",
              stroke: "#00ff00",
              children: [
                {
                  type: "transform",
                  matrix: [2, 0, 0, 2, 0, 0],
                  children: [
                    {
                      type: "circle",
                      center: { x: 0, y: 0 },
                      radius: 10,
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      expect(fragment.root.children).toHaveLength(1);
      const material = fragment.root.children[0];
      expect(material.type).toBe("material");
    });
  });

  describe("Embed", () => {
    it("should allow creating an Embed node", () => {
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

      const embed: Embed = {
        type: "embed",
        namespace: "star1",
        rootMaterialId: "root",
        fragment,
      };

      expect(embed.type).toBe("embed");
      expect(embed.namespace).toBe("star1");
      expect(embed.rootMaterialId).toBe("root");
      expect(embed.fragment).toBe(fragment);
    });

    it("should allow namespace with letters only", () => {
      const embed: Embed = {
        type: "embed",
        namespace: "myFragment",
        rootMaterialId: "root",
        fragment: {
          root: {
            type: "root-material-ref",
            id: "r",
            children: [],
          },
        },
      };
      expect(embed.namespace).toBe("myFragment");
    });

    it("should allow namespace with letters and numbers", () => {
      const embed: Embed = {
        type: "embed",
        namespace: "star2ndVersion",
        rootMaterialId: "root",
        fragment: {
          root: {
            type: "root-material-ref",
            id: "r",
            children: [],
          },
        },
      };
      expect(embed.namespace).toBe("star2ndVersion");
    });

    it("should allow embedding into non-root material", () => {
      const embed: Embed = {
        type: "embed",
        namespace: "nested",
        rootMaterialId: "childMaterial",
        fragment: {
          root: {
            type: "root-material-ref",
            id: "r",
            children: [],
          },
        },
      };
      expect(embed.rootMaterialId).toBe("childMaterial");
    });
  });

  describe("UnresolvedFrameNode", () => {
    it("should accept FrameNode types", () => {
      const circle: UnresolvedFrameNode = {
        type: "circle",
        center: { x: 0, y: 0 },
        radius: 10,
      };
      expect(circle.type).toBe("circle");

      const material: UnresolvedFrameNode = {
        type: "material",
        id: "root",
        fill: "#000",
        stroke: "#fff",
        strokeWidth: 1,
        children: [],
      };
      expect(material.type).toBe("material");

      const transform: UnresolvedFrameNode = {
        type: "transform",
        matrix: [1, 0, 0, 1, 0, 0],
        children: [],
      };
      expect(transform.type).toBe("transform");
    });

    it("should accept Embed type", () => {
      const embed: UnresolvedFrameNode = {
        type: "embed",
        namespace: "test",
        rootMaterialId: "root",
        fragment: {
          root: {
            type: "root-material-ref",
            id: "r",
            children: [],
          },
        },
      };
      expect(embed.type).toBe("embed");
    });

    it("should allow array of mixed UnresolvedFrameNode types", () => {
      const nodes: UnresolvedFrameNode[] = [
        {
          type: "circle",
          center: { x: 0, y: 0 },
          radius: 10,
        },
        {
          type: "embed",
          namespace: "star",
          rootMaterialId: "root",
          fragment: {
            root: {
              type: "root-material-ref",
              id: "r",
              children: [],
            },
          },
        },
        {
          type: "rectangle",
          center: { x: 0, y: 0 },
          width: 20,
          height: 10,
        },
      ];
      expect(nodes).toHaveLength(3);
      expect(nodes[0].type).toBe("circle");
      expect(nodes[1].type).toBe("embed");
      expect(nodes[2].type).toBe("rectangle");
    });
  });

  describe("FragmentGenerator", () => {
    it("should allow implementing FragmentGenerator interface", () => {
      const generator: FragmentGenerator = {
        fragment: (context: RenderContext): Fragment => ({
          root: {
            type: "root-material-ref",
            id: "root",
            children: [
              {
                type: "circle",
                center: { x: 0, y: 0 },
                radius: Math.sin(context.time / 1000) * 10 + 20,
              },
            ],
          },
        }),
      };

      const fragment = generator.fragment({
        time: 0,
        targetDimensions: [100, 100],
      });
      expect(fragment.root.type).toBe("root-material-ref");
      expect(fragment.root.children).toHaveLength(1);
    });

    it("should allow class-based FragmentGenerator implementation", () => {
      class StarFragment implements FragmentGenerator {
        private pointCount: number;

        constructor(pointCount: number) {
          this.pointCount = pointCount;
        }

        fragment(context: RenderContext): Fragment {
          // Generate star points based on time and point count
          const children: FrameNode[] = [];
          for (let i = 0; i < this.pointCount; i++) {
            const angle =
              (i / this.pointCount) * Math.PI * 2 + context.time / 1000;
            children.push({
              type: "line",
              start: { x: 0, y: 0 },
              end: { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50 },
            });
          }
          return {
            root: {
              type: "root-material-ref",
              id: "star_root",
              children,
            },
          };
        }
      }

      const starGen: FragmentGenerator = new StarFragment(5);
      const fragment = starGen.fragment({
        time: 0,
        targetDimensions: [200, 200],
      });

      expect(fragment.root.id).toBe("star_root");
      expect(fragment.root.children).toHaveLength(5);
    });

    it("should allow FragmentGenerator that uses targetDimensions", () => {
      const responsiveGenerator: FragmentGenerator = {
        fragment: (context: RenderContext): Fragment => {
          const [width, height] = context.targetDimensions;
          const size = Math.min(width, height) / 4;

          return {
            root: {
              type: "root-material-ref",
              id: "responsive",
              children: [
                {
                  type: "rectangle",
                  center: { x: 0, y: 0 },
                  width: size,
                  height: size,
                },
              ],
            },
          };
        },
      };

      const fragment = responsiveGenerator.fragment({
        time: 0,
        targetDimensions: [400, 300],
      });

      const rect = fragment.root.children[0];
      expect(rect.type).toBe("rectangle");
      if (rect.type === "rectangle") {
        expect(rect.width).toBe(75); // min(400, 300) / 4 = 75
        expect(rect.height).toBe(75);
      }
    });
  });
});

describe("validateFragment", () => {
  // Helper to create a valid fragment for modification
  function createValidFragment(): Fragment {
    return {
      root: {
        type: "root-material-ref",
        id: "fragment_root",
        children: [],
      },
    };
  }

  describe("RootMaterialRef validation", () => {
    it("should pass for RootMaterialRef with non-empty ID", () => {
      const fragment = createValidFragment();
      fragment.root.id = "valid_id";
      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });

    it("should fail for RootMaterialRef with empty ID", () => {
      const fragment = createValidFragment();
      fragment.root.id = "";
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "RootMaterialRef must have a non-empty ID",
      });
    });
  });

  describe("empty fragment validation", () => {
    it("should pass for empty fragment (no children)", () => {
      const fragment = createValidFragment();
      fragment.root.children = [];
      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });
  });

  describe("material ID validation", () => {
    it("should fail for duplicate material IDs", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "duplicate",
          ref: "fragment_root",
          children: [],
        },
        {
          type: "material",
          id: "duplicate",
          ref: "fragment_root",
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Duplicate material ID: duplicate",
      });
    });

    it("should fail for duplicate material IDs in nested structure", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "mat1",
          ref: "fragment_root",
          children: [
            {
              type: "material",
              id: "mat1",
              ref: "fragment_root",
              children: [],
            },
          ],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Duplicate material ID: mat1",
      });
    });
  });

  describe("ancestor ref validation", () => {
    it("should pass for material referencing ancestor", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "child",
          ref: "fragment_root",
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });

    it("should fail for non-ancestor refs", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "child",
          ref: "nonexistent",
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: 'Material "child" references non-ancestor: "nonexistent"',
      });
    });

    it("should fail for material ref pointing to sibling", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "sibling1",
          ref: "fragment_root",
          children: [],
        },
        {
          type: "material",
          id: "sibling2",
          ref: "sibling1",
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: 'Material "sibling2" references non-ancestor: "sibling1"',
      });
    });
  });

  describe("transform matrix validation", () => {
    it("should pass for valid transform matrix", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "transform",
          matrix: [1, 0, 0, 1, 10, 20],
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });

    it("should fail for transform matrix with wrong length (too few)", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "transform",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matrix: [1, 0, 0, 1, 0] as any,
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix must have exactly 6 values, got 5",
      });
    });

    it("should fail for transform matrix with wrong length (too many)", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "transform",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matrix: [1, 0, 0, 1, 0, 0, 0] as any,
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix must have exactly 6 values, got 7",
      });
    });

    it("should fail for transform matrix with NaN value", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "transform",
          matrix: [1, 0, NaN, 1, 0, 0],
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix[2] must be a finite number",
      });
    });

    it("should fail for transform matrix with Infinity value", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "transform",
          matrix: [1, 0, 0, 1, Infinity, 0],
          children: [],
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Transform matrix[4] must be a finite number",
      });
    });
  });

  describe("image validation", () => {
    it("should pass for valid image", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });

    it("should fail for image with empty URL", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "image",
          url: "",
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Image url must be a non-empty string",
      });
    });

    it("should fail for image with invalid width", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 0,
          height: 100,
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Image width must be a positive finite number",
      });
    });

    it("should fail for image with invalid height", () => {
      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "image",
          url: "https://example.com/image.png",
          position: { x: 0, y: 0 },
          width: 100,
          height: -10,
        },
      ];
      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "Image height must be a positive finite number",
      });
    });
  });

  describe("nested embeds validation", () => {
    it("should validate fragment with nested embeds recursively", () => {
      const innerFragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "inner_root",
          children: [
            {
              type: "circle",
              center: { x: 0, y: 0 },
              radius: 10,
            },
          ],
        },
      };

      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "mat1",
          ref: "fragment_root",
          children: [
            {
              type: "embed",
              namespace: "inner",
              rootMaterialId: "mat1",
              fragment: innerFragment,
            } as unknown as FrameNode,
          ],
        },
      ];

      const result = validateFragment(fragment);
      expect(result).toEqual({ valid: true });
    });

    it("should propagate errors from nested fragment validation", () => {
      const invalidInnerFragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "", // Invalid: empty ID
          children: [],
        },
      };

      const fragment = createValidFragment();
      fragment.root.children = [
        {
          type: "material",
          id: "mat1",
          ref: "fragment_root",
          children: [
            {
              type: "embed",
              namespace: "inner",
              rootMaterialId: "mat1",
              fragment: invalidInnerFragment,
            } as unknown as FrameNode,
          ],
        },
      ];

      const result = validateFragment(fragment);
      expect(result).toEqual({
        valid: false,
        error: "RootMaterialRef must have a non-empty ID",
      });
    });
  });
});

describe("validateEmbed", () => {
  // Helper to create a valid fragment
  function createValidFragment(): Fragment {
    return {
      root: {
        type: "root-material-ref",
        id: "fragment_root",
        children: [],
      },
    };
  }

  // Helper to create a valid embed
  function createValidEmbed(): Embed {
    return {
      type: "embed",
      namespace: "test",
      rootMaterialId: "root",
      fragment: createValidFragment(),
    };
  }

  describe("namespace validation", () => {
    it("should pass for valid namespace with letters only", () => {
      const embed = createValidEmbed();
      embed.namespace = "myNamespace";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({ valid: true });
    });

    it("should pass for valid namespace with letters and numbers", () => {
      const embed = createValidEmbed();
      embed.namespace = "star2ndVersion";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({ valid: true });
    });

    it("should fail for namespace with underscore", () => {
      const embed = createValidEmbed();
      embed.namespace = "my_namespace";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error:
          "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
      });
    });

    it("should fail for namespace starting with number", () => {
      const embed = createValidEmbed();
      embed.namespace = "2ndVersion";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error:
          "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
      });
    });

    it("should fail for empty namespace", () => {
      const embed = createValidEmbed();
      embed.namespace = "";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error:
          "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
      });
    });

    it("should fail for namespace with special characters", () => {
      const embed = createValidEmbed();
      embed.namespace = "my-namespace";
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error:
          "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
      });
    });
  });

  describe("namespace collision validation", () => {
    it("should fail for duplicate namespace in same scope", () => {
      const embed = createValidEmbed();
      embed.namespace = "duplicate";
      const usedNamespaces = new Set(["duplicate"]);
      const result = validateEmbed(embed, new Set(["root"]), usedNamespaces);
      expect(result).toEqual({
        valid: false,
        error: 'Namespace "duplicate" already used in this scope',
      });
    });

    it("should pass for unique namespace", () => {
      const embed = createValidEmbed();
      embed.namespace = "unique";
      const usedNamespaces = new Set(["other"]);
      const result = validateEmbed(embed, new Set(["root"]), usedNamespaces);
      expect(result).toEqual({ valid: true });
    });
  });

  describe("rootMaterialId validation", () => {
    it("should pass for rootMaterialId that is an ancestor", () => {
      const embed = createValidEmbed();
      embed.rootMaterialId = "parentMaterial";
      const ancestors = new Set(["root", "parentMaterial"]);
      const result = validateEmbed(embed, ancestors, new Set());
      expect(result).toEqual({ valid: true });
    });

    it("should fail for non-ancestor rootMaterialId", () => {
      const embed = createValidEmbed();
      embed.rootMaterialId = "nonexistent";
      const ancestors = new Set(["root"]);
      const result = validateEmbed(embed, ancestors, new Set());
      expect(result).toEqual({
        valid: false,
        error: 'rootMaterialId "nonexistent" is not an ancestor material',
      });
    });

    it("should fail for rootMaterialId referencing sibling material", () => {
      const embed = createValidEmbed();
      embed.rootMaterialId = "sibling";
      const ancestors = new Set(["root"]); // sibling not in ancestors
      const result = validateEmbed(embed, ancestors, new Set());
      expect(result).toEqual({
        valid: false,
        error: 'rootMaterialId "sibling" is not an ancestor material',
      });
    });
  });

  describe("fragment validation propagation", () => {
    it("should propagate errors from fragment validation", () => {
      const embed = createValidEmbed();
      embed.fragment = {
        root: {
          type: "root-material-ref",
          id: "", // Invalid: empty ID
          children: [],
        },
      };
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error: "RootMaterialRef must have a non-empty ID",
      });
    });

    it("should propagate errors from fragment with invalid material refs", () => {
      const embed = createValidEmbed();
      embed.fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "nonexistent",
              children: [],
            },
          ],
        },
      };
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({
        valid: false,
        error: 'Material "child" references non-ancestor: "nonexistent"',
      });
    });

    it("should pass for embed with valid fragment", () => {
      const embed = createValidEmbed();
      embed.fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "frag_root",
              fill: "#ff0000",
              children: [
                {
                  type: "circle",
                  center: { x: 0, y: 0 },
                  radius: 10,
                },
              ],
            },
          ],
        },
      };
      const result = validateEmbed(embed, new Set(["root"]), new Set());
      expect(result).toEqual({ valid: true });
    });
  });
});

describe("resolveEmbed", () => {
  // Helper to create a simple fragment
  function createSimpleFragment(rootId: string = "frag_root"): Fragment {
    return {
      root: {
        type: "root-material-ref",
        id: rootId,
        children: [],
      },
    };
  }

  describe("material ID namespacing", () => {
    it("should namespace material IDs correctly", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child1",
              ref: "frag_root",
              children: [],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "star",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("material");
      expect((result[0] as ChildMaterial).id).toBe("star_child1");
    });

    it("should namespace nested material IDs", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "outer",
              ref: "frag_root",
              children: [
                {
                  type: "material",
                  id: "inner",
                  ref: "outer",
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "ns",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      expect(result).toHaveLength(1);
      const outer = result[0] as ChildMaterial;
      expect(outer.id).toBe("ns_outer");
      expect(outer.children).toHaveLength(1);
      const inner = outer.children[0] as ChildMaterial;
      expect(inner.id).toBe("ns_inner");
    });
  });

  describe("ref rewriting", () => {
    it("should rewrite RootMaterialRef refs to rootMaterialId", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "frag_root",
              children: [],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "star",
        rootMaterialId: "parentMat",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root", "parentMat"]));
      expect(result).toHaveLength(1);
      const child = result[0] as ChildMaterial;
      expect(child.ref).toBe("parentMat");
    });

    it("should namespace internal fragment refs correctly", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "outer",
              ref: "frag_root",
              children: [
                {
                  type: "material",
                  id: "inner",
                  ref: "outer",
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "ns",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      const outer = result[0] as ChildMaterial;
      expect(outer.ref).toBe("root"); // was frag_root -> rootMaterialId
      const inner = outer.children[0] as ChildMaterial;
      expect(inner.ref).toBe("ns_outer"); // was outer -> ns_outer
    });
  });

  describe("RootMaterialRef removal", () => {
    it("should remove RootMaterialRef and lift children", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "circle",
              center: { x: 0, y: 0 },
              radius: 10,
            },
            {
              type: "rectangle",
              center: { x: 5, y: 5 },
              width: 20,
              height: 10,
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "star",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      // RootMaterialRef is removed, its children are the result
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("circle");
      expect(result[1].type).toBe("rectangle");
    });
  });

  describe("nested embeds", () => {
    it("should resolve nested embeds with compound namespaces", () => {
      const innerFragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "inner_root",
          children: [
            {
              type: "material",
              id: "innerMat",
              ref: "inner_root",
              children: [],
            },
          ],
        },
      };

      const outerFragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "outer_root",
          children: [
            {
              type: "material",
              id: "outerMat",
              ref: "outer_root",
              children: [
                {
                  type: "embed",
                  namespace: "nested",
                  rootMaterialId: "outerMat",
                  fragment: innerFragment,
                } as unknown as FrameNode,
              ],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "top",
        rootMaterialId: "root",
        fragment: outerFragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      expect(result).toHaveLength(1);

      const outerMat = result[0] as ChildMaterial;
      expect(outerMat.id).toBe("top_outerMat");
      expect(outerMat.ref).toBe("root");

      // The nested embed should be resolved with compound namespace
      expect(outerMat.children).toHaveLength(1);
      const innerMat = outerMat.children[0] as ChildMaterial;
      expect(innerMat.id).toBe("top_nested_innerMat");
      expect(innerMat.ref).toBe("top_outerMat");
    });
  });

  describe("shape passthrough", () => {
    it("should pass shapes through unchanged", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "circle",
              center: { x: 10, y: 20 },
              radius: 15,
            },
            {
              type: "line",
              start: { x: 0, y: 0 },
              end: { x: 100, y: 100 },
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "shapes",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      expect(result).toHaveLength(2);

      expect(result[0].type).toBe("circle");
      expect(result[0]).toEqual({
        type: "circle",
        center: { x: 10, y: 20 },
        radius: 15,
      });

      expect(result[1].type).toBe("line");
      expect(result[1]).toEqual({
        type: "line",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });
    });
  });

  describe("transform passthrough", () => {
    it("should pass transforms through unchanged", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "transform",
              matrix: [2, 0, 0, 2, 10, 20],
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

      const embed: Embed = {
        type: "embed",
        namespace: "tr",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      expect(result).toHaveLength(1);

      const transform = result[0] as Transform;
      expect(transform.type).toBe("transform");
      expect(transform.matrix).toEqual([2, 0, 0, 2, 10, 20]);
      expect(transform.children).toHaveLength(1);
      expect(transform.children[0].type).toBe("circle");
    });
  });

  describe("error handling", () => {
    it("should throw on non-ancestor rootMaterialId", () => {
      const fragment = createSimpleFragment();
      const embed: Embed = {
        type: "embed",
        namespace: "test",
        rootMaterialId: "nonexistent",
        fragment,
      };

      expect(() => resolveEmbed(embed, new Set(["root"]))).toThrow(
        'Embed rootMaterialId "nonexistent" is not an ancestor material'
      );
    });
  });

  describe("style override preservation", () => {
    it("should preserve style overrides on materials", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "styled",
              ref: "frag_root",
              fill: "#ff0000",
              stroke: "#00ff00",
              strokeWidth: 3,
              children: [],
            },
          ],
        },
      };

      const embed: Embed = {
        type: "embed",
        namespace: "s",
        rootMaterialId: "root",
        fragment,
      };

      const result = resolveEmbed(embed, new Set(["root"]));
      const mat = result[0] as ChildMaterial;
      expect(mat.fill).toBe("#ff0000");
      expect(mat.stroke).toBe("#00ff00");
      expect(mat.strokeWidth).toBe(3);
    });
  });
});

describe("resolveFrame", () => {
  // Helper to create a valid frame
  function createValidFrame(): Frame {
    return {
      viewport: {
        halfWidth: 100,
        halfHeight: 100,
        scaleMode: "fit",
      },
      root: {
        type: "material",
        id: "root",
        fill: "#000000",
        stroke: "#ffffff",
        strokeWidth: 1,
        children: [],
      },
    };
  }

  describe("frame with no embeds", () => {
    it("should return unchanged frame when no embeds present", () => {
      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "circle",
          center: { x: 0, y: 0 },
          radius: 10,
        },
      ];

      const result = resolveFrame(frame);
      expect(result.viewport).toEqual(frame.viewport);
      expect(result.root.id).toBe("root");
      expect(result.root.children).toHaveLength(1);
      expect(result.root.children[0].type).toBe("circle");
    });

    it("should preserve background when present", () => {
      const frame = createValidFrame();
      frame.background = "#888888";

      const result = resolveFrame(frame);
      expect(result.background).toBe("#888888");
    });
  });

  describe("frame with single embed", () => {
    it("should resolve single embed correctly", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "circle",
              center: { x: 5, y: 5 },
              radius: 3,
            },
          ],
        },
      };

      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "embed",
          namespace: "star",
          rootMaterialId: "root",
          fragment,
        } as unknown as FrameNode,
      ];

      const result = resolveFrame(frame);
      expect(result.root.children).toHaveLength(1);
      expect(result.root.children[0].type).toBe("circle");
    });
  });

  describe("frame with multiple embeds", () => {
    it("should resolve multiple embeds at same level", () => {
      const fragment1: Fragment = {
        root: {
          type: "root-material-ref",
          id: "f1",
          children: [{ type: "circle", center: { x: 0, y: 0 }, radius: 5 }],
        },
      };

      const fragment2: Fragment = {
        root: {
          type: "root-material-ref",
          id: "f2",
          children: [
            {
              type: "rectangle",
              center: { x: 0, y: 0 },
              width: 10,
              height: 10,
            },
          ],
        },
      };

      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "embed",
          namespace: "e1",
          rootMaterialId: "root",
          fragment: fragment1,
        } as unknown as FrameNode,
        {
          type: "embed",
          namespace: "e2",
          rootMaterialId: "root",
          fragment: fragment2,
        } as unknown as FrameNode,
      ];

      const result = resolveFrame(frame);
      expect(result.root.children).toHaveLength(2);
      expect(result.root.children[0].type).toBe("circle");
      expect(result.root.children[1].type).toBe("rectangle");
    });
  });

  describe("resolved frame validation", () => {
    it("should produce a frame that passes validateFrame", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "childMat",
              ref: "frag_root",
              fill: "#ff0000",
              children: [
                { type: "circle", center: { x: 0, y: 0 }, radius: 10 },
              ],
            },
          ],
        },
      };

      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "embed",
          namespace: "star",
          rootMaterialId: "root",
          fragment,
        } as unknown as FrameNode,
      ];

      const result = resolveFrame(frame);
      const validation = validateFrame(result);
      expect(validation).toEqual({ valid: true });
    });

    it("should correctly namespace material refs for validation", () => {
      // Fragment with multiple levels of materials
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "level1",
              ref: "frag_root",
              children: [
                {
                  type: "material",
                  id: "level2",
                  ref: "level1",
                  children: [
                    { type: "circle", center: { x: 0, y: 0 }, radius: 5 },
                  ],
                },
              ],
            },
          ],
        },
      };

      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "embed",
          namespace: "ns",
          rootMaterialId: "root",
          fragment,
        } as unknown as FrameNode,
      ];

      const result = resolveFrame(frame);
      const validation = validateFrame(result);
      expect(validation).toEqual({ valid: true });

      // Verify the material structure
      const level1 = result.root.children[0] as ChildMaterial;
      expect(level1.id).toBe("ns_level1");
      expect(level1.ref).toBe("root");

      const level2 = level1.children[0] as ChildMaterial;
      expect(level2.id).toBe("ns_level2");
      expect(level2.ref).toBe("ns_level1");
    });
  });

  describe("nested materials with embeds", () => {
    it("should resolve embeds inside ChildMaterial correctly", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [{ type: "circle", center: { x: 0, y: 0 }, radius: 5 }],
        },
      };

      const frame = createValidFrame();
      frame.root.children = [
        {
          type: "material",
          id: "childMat",
          ref: "root",
          fill: "#ff0000",
          children: [
            {
              type: "embed",
              namespace: "inner",
              rootMaterialId: "childMat",
              fragment,
            } as unknown as FrameNode,
          ],
        },
      ];

      const result = resolveFrame(frame);
      expect(result.root.children).toHaveLength(1);

      const childMat = result.root.children[0] as ChildMaterial;
      expect(childMat.id).toBe("childMat");
      expect(childMat.children).toHaveLength(1);
      expect(childMat.children[0].type).toBe("circle");
    });
  });
});

describe("fragmentToFrame", () => {
  // Helper viewport
  const viewport: Viewport = {
    halfWidth: 100,
    halfHeight: 100,
    scaleMode: "fit",
  };

  // Helper default material
  const defaultMaterial = {
    fill: "#000000",
    stroke: "#ffffff",
    strokeWidth: 1,
  };

  describe("RootMaterialRef conversion", () => {
    it("should convert RootMaterialRef to RootMaterial with provided styles", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      expect(frame.root.type).toBe("material");
      expect(frame.root.id).toBe("root");
      expect(frame.root.fill).toBe("#000000");
      expect(frame.root.stroke).toBe("#ffffff");
      expect(frame.root.strokeWidth).toBe(1);
    });

    it("should use custom rootId when provided", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [],
        },
      };

      const frame = fragmentToFrame(
        fragment,
        viewport,
        defaultMaterial,
        "customRoot"
      );

      expect(frame.root.id).toBe("customRoot");
    });
  });

  describe("viewport application", () => {
    it("should apply viewport correctly", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [],
        },
      };

      const customViewport: Viewport = {
        halfWidth: 200,
        halfHeight: 150,
        scaleMode: "fill",
      };

      const frame = fragmentToFrame(fragment, customViewport, defaultMaterial);

      expect(frame.viewport).toEqual(customViewport);
    });
  });

  describe("children preservation", () => {
    it("should preserve children from fragment", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            { type: "circle", center: { x: 0, y: 0 }, radius: 10 },
            {
              type: "rectangle",
              center: { x: 5, y: 5 },
              width: 20,
              height: 10,
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      expect(frame.root.children).toHaveLength(2);
      expect(frame.root.children[0].type).toBe("circle");
      expect(frame.root.children[1].type).toBe("rectangle");
    });
  });

  describe("ref rewriting", () => {
    it("should rewrite refs to RootMaterialRef.id to new rootId", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "frag_root",
              fill: "#ff0000",
              children: [],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      const child = frame.root.children[0] as ChildMaterial;
      expect(child.ref).toBe("root"); // Was "frag_root", now "root"
    });

    it("should preserve other refs unchanged", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "outer",
              ref: "frag_root",
              children: [
                {
                  type: "material",
                  id: "inner",
                  ref: "outer",
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      const outer = frame.root.children[0] as ChildMaterial;
      expect(outer.ref).toBe("root"); // Rewritten

      const inner = outer.children[0] as ChildMaterial;
      expect(inner.ref).toBe("outer"); // Unchanged
    });

    it("should rewrite refs with custom rootId", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "frag_root",
              children: [],
            },
          ],
        },
      };

      const frame = fragmentToFrame(
        fragment,
        viewport,
        defaultMaterial,
        "myRoot"
      );

      const child = frame.root.children[0] as ChildMaterial;
      expect(child.ref).toBe("myRoot");
    });
  });

  describe("style override preservation", () => {
    it("should preserve style overrides on ChildMaterials", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "styled",
              ref: "frag_root",
              fill: "#ff0000",
              stroke: "#00ff00",
              strokeWidth: 5,
              children: [],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      const styled = frame.root.children[0] as ChildMaterial;
      expect(styled.fill).toBe("#ff0000");
      expect(styled.stroke).toBe("#00ff00");
      expect(styled.strokeWidth).toBe(5);
    });
  });

  describe("transform handling", () => {
    it("should preserve transforms in children", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "transform",
              matrix: [2, 0, 0, 2, 10, 20],
              children: [{ type: "circle", center: { x: 0, y: 0 }, radius: 5 }],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      const transform = frame.root.children[0] as Transform;
      expect(transform.type).toBe("transform");
      expect(transform.matrix).toEqual([2, 0, 0, 2, 10, 20]);
    });

    it("should rewrite refs inside transforms", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "transform",
              matrix: [1, 0, 0, 1, 0, 0],
              children: [
                {
                  type: "material",
                  id: "child",
                  ref: "frag_root",
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);

      const transform = frame.root.children[0] as Transform;
      const child = transform.children[0] as ChildMaterial;
      expect(child.ref).toBe("root");
    });
  });

  describe("validation of result", () => {
    it("should produce a valid frame", () => {
      const fragment: Fragment = {
        root: {
          type: "root-material-ref",
          id: "frag_root",
          children: [
            {
              type: "material",
              id: "child",
              ref: "frag_root",
              fill: "#ff0000",
              children: [
                { type: "circle", center: { x: 0, y: 0 }, radius: 10 },
              ],
            },
          ],
        },
      };

      const frame = fragmentToFrame(fragment, viewport, defaultMaterial);
      const validation = validateFrame(frame);
      expect(validation).toEqual({ valid: true });
    });
  });
});
