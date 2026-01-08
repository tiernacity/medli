import type {
  Frame,
  Generator,
  Circle as CircleShape,
  Line as LineShape,
  RootMaterial,
  ChildMaterial,
  FrameNode,
  Matrix2D,
  Transform,
} from "@medli/spec";

// ============================================================================
// Matrix Math Helpers
// ============================================================================

/**
 * Create an identity matrix [1,0,0,1,0,0].
 */
export function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Create a translation matrix.
 * [1, 0, 0, 1, x, y]
 */
export function translateMatrix(x: number, y: number): Matrix2D {
  return [1, 0, 0, 1, x, y];
}

/**
 * Create a rotation matrix for the given angle in radians.
 * [cos(a), sin(a), -sin(a), cos(a), 0, 0]
 */
export function rotateMatrix(angle: number): Matrix2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * Create a scale matrix.
 * [sx, 0, 0, sy, 0, 0]
 */
export function scaleMatrix(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Multiply two 2D affine matrices.
 * Result = a * b
 *
 * When applied to a point: (a * b) * point = a * (b * point)
 * So b is applied first, then a.
 *
 * Matrix format: [a, b, c, d, e, f] represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 */
export function multiplyMatrices(a: Matrix2D, b: Matrix2D): Matrix2D {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;

  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ];
}

/**
 * Check if a matrix is the identity matrix.
 */
export function isIdentityMatrix(m: Matrix2D): boolean {
  return (
    m[0] === 1 &&
    m[1] === 0 &&
    m[2] === 0 &&
    m[3] === 1 &&
    m[4] === 0 &&
    m[5] === 0
  );
}

// Global counter for unique material IDs
let materialIdCounter = 0;

/**
 * SceneObject - base interface for objects that can be added to a scene.
 * Shapes implement this to provide their frame data.
 */
export interface SceneObject {
  frame(time: number): FrameNode[];
}

/**
 * Shape - base interface for shapes that can reference a Material.
 * Shapes are added to the scene independently and reference materials.
 */
export interface Shape extends SceneObject {
  material?: Material;
}

/**
 * Background - represents the scene background color.
 * Does not contribute shapes, only sets backgroundColor on Scene.
 */
export class Background implements SceneObject {
  color: string;

  constructor(color = "#000000") {
    this.color = color;
  }

  frame(_time: number): FrameNode[] {
    // Background doesn't add shapes, it's handled specially by Scene
    return [];
  }
}

/**
 * Circle - a circle shape with center position and radius.
 * Can optionally reference a Material for styling.
 */
export class Circle implements Shape {
  x: number;
  y: number;
  radius: number;
  material?: Material;

  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  frame(_time: number): FrameNode[] {
    const shape: CircleShape = {
      type: "circle",
      center: { x: this.x, y: this.y },
      radius: this.radius,
    };
    return [shape];
  }
}

/**
 * Line - a line from start to end position.
 * Can optionally reference a Material for styling.
 */
export class Line implements Shape {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  material?: Material;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  static fromOffset(x: number, y: number, dx: number, dy: number): Line {
    return new Line(x, y, x + dx, y + dy);
  }

  frame(_time: number): FrameNode[] {
    const shape: LineShape = {
      type: "line",
      start: { x: this.x1, y: this.y1 },
      end: { x: this.x2, y: this.y2 },
    };
    return [shape];
  }
}

/**
 * Position in 2D space.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Scale can be uniform (single number) or non-uniform (x, y).
 */
export type ScaleValue = number | Position;

/**
 * Group - a container for shapes with transform properties.
 * Follows the three.js Object3D pattern for position, rotation, scale.
 *
 * When frame() is called, Groups emit Transform nodes containing their children.
 * Transform is applied in order: scale -> rotate -> translate (TRS order).
 */
export class Group implements SceneObject {
  /** Position offset (translation) */
  position: Position = { x: 0, y: 0 };

  /** Rotation in radians */
  rotation: number = 0;

  /** Scale factor (uniform or non-uniform) */
  scale: ScaleValue = 1;

  /** Optional material applied to all children */
  material?: Material;

  private children: SceneObject[] = [];

  /**
   * Add a child object to this group.
   */
  add(child: SceneObject): this {
    this.children.push(child);
    return this;
  }

  /**
   * Remove a child object from this group.
   */
  remove(child: SceneObject): this {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    return this;
  }

  /**
   * Get all children of this group.
   */
  getChildren(): SceneObject[] {
    return [...this.children];
  }

  /**
   * Compute the combined transformation matrix.
   * Applied in TRS order: scale -> rotate -> translate.
   *
   * Matrix composition: T * R * S (applied right-to-left)
   * This means: first scale, then rotate, then translate.
   */
  computeMatrix(): Matrix2D {
    // Start with identity
    let matrix = identityMatrix();

    // Build matrix as T * R * S (right-to-left application)
    // We multiply in reverse order: S first, then R, then T

    // Apply scale (innermost, applied first to points)
    const sx = typeof this.scale === "number" ? this.scale : this.scale.x;
    const sy = typeof this.scale === "number" ? this.scale : this.scale.y;
    if (sx !== 1 || sy !== 1) {
      matrix = scaleMatrix(sx, sy);
    }

    // Apply rotation (middle)
    if (this.rotation !== 0) {
      matrix = multiplyMatrices(rotateMatrix(this.rotation), matrix);
    }

    // Apply translation (outermost, applied last to points)
    if (this.position.x !== 0 || this.position.y !== 0) {
      matrix = multiplyMatrices(
        translateMatrix(this.position.x, this.position.y),
        matrix
      );
    }

    return matrix;
  }

  /**
   * Check if this group has a non-identity transform.
   */
  hasTransform(): boolean {
    return !isIdentityMatrix(this.computeMatrix());
  }

  frame(time: number): FrameNode[] {
    // Collect children frame data
    const childNodes: FrameNode[] = [];
    for (const child of this.children) {
      childNodes.push(...child.frame(time));
    }

    // If no transform, just return children
    if (!this.hasTransform()) {
      return childNodes;
    }

    // Wrap children in a Transform node
    const transform: Transform = {
      type: "transform",
      matrix: this.computeMatrix(),
      children: childNodes,
    };

    return [transform];
  }
}

/**
 * Style properties for Material.
 */
export interface MaterialStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * Material - provides style properties for shapes.
 * Materials are added to scene independently; shapes reference them via .material property.
 * This follows the three.js pattern where materials and shapes are separate scene objects.
 */
export class Material implements SceneObject {
  readonly id: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Optional parent material for style inheritance */
  parent?: Material;

  constructor(style: MaterialStyle = {}) {
    this.id = `m${++materialIdCounter}`;
    this.fill = style.fill;
    this.stroke = style.stroke;
    this.strokeWidth = style.strokeWidth;
  }

  /**
   * Materials don't contribute shapes directly to the frame.
   * Scene.frame() groups shapes by their material reference.
   */
  frame(_time: number): FrameNode[] {
    return [];
  }
}

/**
 * Helper to check if an object is a Shape (has optional material property).
 */
function isShape(obj: SceneObject): obj is Shape {
  return (
    obj instanceof Circle ||
    obj instanceof Line ||
    obj instanceof Group ||
    ("material" in obj && obj !== null)
  );
}

/**
 * Scene - the root container and generator for object-oriented scenes.
 * Builds a Material-based tree by grouping shapes by their material reference.
 *
 * This follows the three.js pattern:
 * - Materials are added to scene independently
 * - Shapes reference materials via .material property
 * - Scene.frame() groups shapes by material to build the IR tree
 */
export class Scene implements Generator {
  private _background: Background | null = null;
  private children: SceneObject[] = [];

  // Default material properties (used for root material)
  fill = "#000000";
  stroke = "#000000";
  strokeWidth = 1;

  get background(): Background | null {
    return this._background;
  }

  setBackground(bg: Background | null): this {
    this._background = bg;
    return this;
  }

  add(child: SceneObject): this {
    if (child instanceof Background) {
      this._background = child;
    } else {
      this.children.push(child);
    }
    return this;
  }

  remove(child: SceneObject): this {
    if (child === this._background) {
      this._background = null;
    } else {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
      }
    }
    return this;
  }

  frame(time: number): Frame {
    // Collect all materials (from explicit adds and from shape references)
    const allMaterials = new Set<Material>();
    // Track which materials were explicitly added to scene (for ordering)
    const explicitMaterials = new Set<Material>();

    for (const child of this.children) {
      if (child instanceof Material) {
        allMaterials.add(child);
        explicitMaterials.add(child);
        // Also add parent materials to the set
        let parent = child.parent;
        while (parent) {
          allMaterials.add(parent);
          parent = parent.parent;
        }
      } else if (isShape(child)) {
        // Collect materials referenced by shapes
        if (child.material) {
          allMaterials.add(child.material);
          // Also add parent materials
          let parent = child.material.parent;
          while (parent) {
            allMaterials.add(parent);
            parent = parent.parent;
          }
        }
      }
    }

    // Group shapes by their material (undefined = root material)
    const shapesByMaterial = new Map<Material | undefined, Shape[]>();
    for (const child of this.children) {
      if (isShape(child) && !(child instanceof Material)) {
        const mat = child.material;
        if (!shapesByMaterial.has(mat)) {
          shapesByMaterial.set(mat, []);
        }
        shapesByMaterial.get(mat)!.push(child);
      }
    }

    // Build material tree structure
    // Find root-level materials (no parent or parent not in scene)
    const rootLevelMaterials = new Set<Material>();
    const childMaterialsByParent = new Map<Material, Material[]>();

    for (const mat of allMaterials) {
      const parent = mat.parent;
      if (!parent || !allMaterials.has(parent)) {
        rootLevelMaterials.add(mat);
      } else {
        if (!childMaterialsByParent.has(parent)) {
          childMaterialsByParent.set(parent, []);
        }
        childMaterialsByParent.get(parent)!.push(mat);
      }
    }

    // Build ChildMaterial nodes recursively
    const buildChildMaterial = (mat: Material): ChildMaterial => {
      const children: FrameNode[] = [];

      // Add shapes that reference this material
      const matShapes = shapesByMaterial.get(mat) || [];
      for (const shape of matShapes) {
        children.push(...shape.frame(time));
      }

      // Add nested child materials
      const nestedMaterials = childMaterialsByParent.get(mat) || [];
      for (const nestedMat of nestedMaterials) {
        children.push(buildChildMaterial(nestedMat));
      }

      // Build ChildMaterial with only defined properties
      const childMaterial: ChildMaterial = {
        type: "material",
        id: mat.id,
        ref: mat.parent ? mat.parent.id : "root",
        children,
      };

      if (mat.fill !== undefined) {
        childMaterial.fill = mat.fill;
      }
      if (mat.stroke !== undefined) {
        childMaterial.stroke = mat.stroke;
      }
      if (mat.strokeWidth !== undefined) {
        childMaterial.strokeWidth = mat.strokeWidth;
      }

      return childMaterial;
    };

    // Build root children preserving insertion order
    // Process children in order, outputting:
    // - Shapes without material directly
    // - Materials when first encountered (either explicitly added or referenced by shape)
    const rootChildren: FrameNode[] = [];
    const processedMaterials = new Set<Material>();

    for (const child of this.children) {
      if (child instanceof Material) {
        // Root-level material - add if not already processed
        if (rootLevelMaterials.has(child) && !processedMaterials.has(child)) {
          rootChildren.push(buildChildMaterial(child));
          processedMaterials.add(child);
        }
      } else if (isShape(child)) {
        const mat = child.material;
        if (!mat) {
          // Shape without material goes directly to root
          rootChildren.push(...child.frame(time));
        } else if (
          rootLevelMaterials.has(mat) &&
          !processedMaterials.has(mat)
        ) {
          // First shape referencing this root-level material - add the material
          rootChildren.push(buildChildMaterial(mat));
          processedMaterials.add(mat);
        }
        // Note: shape is already grouped in shapesByMaterial and will be in the material's children
      }
    }

    // Add any remaining root-level materials that weren't encountered
    // (materials that were added via parent chain but never directly added or referenced first)
    for (const mat of rootLevelMaterials) {
      if (!processedMaterials.has(mat)) {
        rootChildren.push(buildChildMaterial(mat));
        processedMaterials.add(mat);
      }
    }

    // Build root material
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      children: rootChildren,
    };

    // Get background color
    const backgroundColor = this._background?.color;

    return { backgroundColor, root };
  }
}
