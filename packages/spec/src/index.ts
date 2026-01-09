/**
 * Core specification types for medli
 */

/**
 * A 2D position with x and y coordinates.
 */
export type Position = {
  x: number;
  y: number;
};

/**
 * A circle shape with center position and radius.
 * Style (fill, stroke) inherited from parent Material.
 */
export type Circle = {
  type: "circle";
  center: Position;
  radius: number;
};

/**
 * A line shape from start to end position.
 * Style (stroke, strokeWidth) inherited from parent Material.
 */
export type Line = {
  type: "line";
  start: Position;
  end: Position;
};

/**
 * A rectangle shape with center position and dimensions.
 * Style (fill, stroke, strokeWidth) inherited from parent Material.
 */
export type Rectangle = {
  type: "rectangle";
  center: Position;
  width: number;
  height: number;
};

/**
 * Defines a rectangular region within the source image for cropping.
 * Coordinates and dimensions are in source image pixels.
 */
export type ImageCrop = {
  /** Source x position in pixels (must be >= 0) */
  x: number;
  /** Source y position in pixels (must be >= 0) */
  y: number;
  /** Source width in pixels (must be > 0) */
  width: number;
  /** Source height in pixels (must be > 0) */
  height: number;
};

/**
 * An image shape positioned in viewport coordinates.
 * URL references an external image resource loaded by the renderer.
 */
export type Image = {
  type: "image";
  url: string;
  position: Position;
  width: number;
  height: number;
  /** Optional source rectangle for cropping. When present, only this region of the source image is rendered. */
  crop?: ImageCrop;
};

/**
 * Union of all shape types.
 */
export type Shape = Circle | Line | Rectangle | Image;

/**
 * Root material with all style properties required.
 * Must be the root of the Frame tree.
 */
export type RootMaterial = {
  type: "material";
  id: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  children: FrameNode[];
};

/**
 * Child material with optional style overrides.
 * Must reference an ancestor material via ref.
 */
export type ChildMaterial = {
  type: "material";
  id: string;
  ref: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  children: FrameNode[];
};

/**
 * A material node providing style context for children.
 */
export type Material = RootMaterial | ChildMaterial;

/**
 * 2D affine transformation matrix as 6 values [a, b, c, d, e, f].
 * Represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 *
 * Point (x, y) transforms to (ax + cy + e, bx + dy + f).
 * Identity matrix: [1, 0, 0, 1, 0, 0]
 */
export type Matrix2D = [number, number, number, number, number, number];

/**
 * A transform node applying a 2D affine transformation to its children.
 * Transforms accumulate via matrix multiplication during traversal.
 * To express identity, simply omit the Transform node entirely.
 */
export type Transform = {
  type: "transform";
  matrix: Matrix2D;
  children: FrameNode[];
};

/**
 * A node in the frame tree - material (style), transform (geometry), or shape (leaf).
 */
export type FrameNode = Material | Transform | Shape;

/**
 * Resolved material with all properties defined.
 * Used by renderers after resolving inheritance.
 */
export type ResolvedMaterial = {
  fill: string;
  stroke: string;
  strokeWidth: number;
};

/**
 * Scale mode for mapping viewport to element.
 * - 'fit': Uniform scale to fit, letterbox/pillarbox empty space
 * - 'fill': Uniform scale to fill, crop content outside element
 * - 'stretch': Non-uniform scale to exactly fill (distorts aspect ratio)
 */
export type ScaleMode = "fit" | "fill" | "stretch";

/**
 * Viewport defines the logical coordinate space for rendering.
 * Origin is at center (0,0) with Y-up convention.
 * X ranges from -halfWidth to +halfWidth.
 * Y ranges from -halfHeight to +halfHeight.
 */
export type Viewport = {
  /** Half the viewport width. X ranges from -halfWidth to +halfWidth. */
  halfWidth: number;
  /** Half the viewport height. Y ranges from -halfHeight to +halfHeight. */
  halfHeight: number;
  /** How viewport maps to differently-sized elements. */
  scaleMode: ScaleMode;
};

/**
 * A frame represents the current state to render.
 * Contains a Material-based tree where root has all style properties defined.
 */
export type Frame = {
  /** Viewport configuration (required). */
  viewport: Viewport;
  /**
   * Background color for the frame.
   * - When present: Clear rendered contents and fill with this color before rendering shapes.
   * - When absent (undefined): Preserve previous frame contents, render new shapes on top.
   */
  background?: string;
  root: RootMaterial;
};

/**
 * Result of frame validation.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a frame's material tree structure.
 * Checks: unique IDs, valid ancestor refs, root completeness.
 * Single-pass, top-to-bottom traversal.
 */
export function validateFrame(frame: Frame): ValidationResult {
  // Validate viewport
  if (!frame.viewport) {
    return { valid: false, error: "Frame missing required property: viewport" };
  }
  if (
    typeof frame.viewport.halfWidth !== "number" ||
    frame.viewport.halfWidth <= 0 ||
    !isFinite(frame.viewport.halfWidth)
  ) {
    return {
      valid: false,
      error: "Viewport halfWidth must be a positive finite number",
    };
  }
  if (
    typeof frame.viewport.halfHeight !== "number" ||
    frame.viewport.halfHeight <= 0 ||
    !isFinite(frame.viewport.halfHeight)
  ) {
    return {
      valid: false,
      error: "Viewport halfHeight must be a positive finite number",
    };
  }
  if (!["fit", "fill", "stretch"].includes(frame.viewport.scaleMode)) {
    return {
      valid: false,
      error: "Viewport scaleMode must be 'fit', 'fill', or 'stretch'",
    };
  }

  // Validate root has all required properties
  const root = frame.root;
  if (root.fill === undefined) {
    return {
      valid: false,
      error: "Root material missing required property: fill",
    };
  }
  if (root.stroke === undefined) {
    return {
      valid: false,
      error: "Root material missing required property: stroke",
    };
  }
  if (root.strokeWidth === undefined) {
    return {
      valid: false,
      error: "Root material missing required property: strokeWidth",
    };
  }

  const seenIds = new Set<string>();

  function validateNode(
    node: FrameNode,
    ancestorIds: Set<string>
  ): ValidationResult {
    if (node.type === "material") {
      // Check ID uniqueness
      if (seenIds.has(node.id)) {
        return { valid: false, error: `Duplicate material ID: ${node.id}` };
      }
      seenIds.add(node.id);

      // Check ref is ancestor (for non-root materials)
      if ("ref" in node) {
        if (!ancestorIds.has(node.ref)) {
          return {
            valid: false,
            error: `Material "${node.id}" references non-ancestor: "${node.ref}"`,
          };
        }
      }

      // Recurse with updated ancestors
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);
      for (const child of node.children) {
        const result = validateNode(child, newAncestors);
        if (!result.valid) return result;
      }
    } else if (node.type === "transform") {
      // Validate matrix has exactly 6 numbers
      if (node.matrix.length !== 6) {
        return {
          valid: false,
          error: `Transform matrix must have exactly 6 values, got ${node.matrix.length}`,
        };
      }
      for (let i = 0; i < node.matrix.length; i++) {
        if (typeof node.matrix[i] !== "number" || !isFinite(node.matrix[i])) {
          return {
            valid: false,
            error: `Transform matrix[${i}] must be a finite number`,
          };
        }
      }

      // Recurse into children (transforms don't affect material ancestor tracking)
      for (const child of node.children) {
        const result = validateNode(child, ancestorIds);
        if (!result.valid) return result;
      }
    } else if (node.type === "image") {
      // Validate image URL is non-empty string
      if (typeof node.url !== "string" || node.url.length === 0) {
        return {
          valid: false,
          error: "Image url must be a non-empty string",
        };
      }
      // Validate width is positive finite number
      if (
        typeof node.width !== "number" ||
        node.width <= 0 ||
        !isFinite(node.width)
      ) {
        return {
          valid: false,
          error: "Image width must be a positive finite number",
        };
      }
      // Validate height is positive finite number
      if (
        typeof node.height !== "number" ||
        node.height <= 0 ||
        !isFinite(node.height)
      ) {
        return {
          valid: false,
          error: "Image height must be a positive finite number",
        };
      }
      // Validate crop properties if present
      if (node.crop !== undefined) {
        // crop.x must be a finite number >= 0
        if (
          typeof node.crop.x !== "number" ||
          node.crop.x < 0 ||
          !isFinite(node.crop.x)
        ) {
          return {
            valid: false,
            error: "Image crop.x must be a non-negative finite number",
          };
        }
        // crop.y must be a finite number >= 0
        if (
          typeof node.crop.y !== "number" ||
          node.crop.y < 0 ||
          !isFinite(node.crop.y)
        ) {
          return {
            valid: false,
            error: "Image crop.y must be a non-negative finite number",
          };
        }
        // crop.width must be a positive finite number
        if (
          typeof node.crop.width !== "number" ||
          node.crop.width <= 0 ||
          !isFinite(node.crop.width)
        ) {
          return {
            valid: false,
            error: "Image crop.width must be a positive finite number",
          };
        }
        // crop.height must be a positive finite number
        if (
          typeof node.crop.height !== "number" ||
          node.crop.height <= 0 ||
          !isFinite(node.crop.height)
        ) {
          return {
            valid: false,
            error: "Image crop.height must be a positive finite number",
          };
        }
      }
    }
    // Other shapes (circle, line) are leaves - no additional validation needed
    return { valid: true };
  }

  // Start from root
  return validateNode(frame.root, new Set());
}

/**
 * Resolve the effective material for a shape by walking up the ancestor chain.
 * Starts with root material and applies overrides from each ancestor.
 */
export function resolveMaterial(ancestors: Material[]): ResolvedMaterial {
  if (ancestors.length === 0) {
    throw new Error(
      "resolveMaterial requires at least one ancestor (the root material)"
    );
  }
  // Root material is always first and has all properties
  const root = ancestors[0] as RootMaterial;
  const resolved: ResolvedMaterial = {
    fill: root.fill,
    stroke: root.stroke,
    strokeWidth: root.strokeWidth,
  };

  // Apply overrides from each child material (index 1 onwards)
  for (let i = 1; i < ancestors.length; i++) {
    const material = ancestors[i] as ChildMaterial;
    if (material.fill !== undefined) resolved.fill = material.fill;
    if (material.stroke !== undefined) resolved.stroke = material.stroke;
    if (material.strokeWidth !== undefined)
      resolved.strokeWidth = material.strokeWidth;
  }

  return resolved;
}

/**
 * Context passed to generators each frame.
 * Contains timing and render target information.
 */
export type RenderContext = {
  /** Time in milliseconds (from requestAnimationFrame) */
  time: number;
  /** Target element dimensions in CSS pixels [width, height] */
  targetDimensions: [number, number];
};

/**
 * Generator produces frames based on context.
 */
export interface Generator {
  frame(context: RenderContext): Frame;
}

/**
 * Renderer displays frames to the screen.
 * Renders content in the Frame's viewport coordinate system.
 * Queries element size on each render and maps viewport to element based on scaleMode.
 * Constructors accept HTML elements of the relevant type.
 * Expects requestAnimationFrame support.
 */
export interface Renderer {
  render(time: number): Promise<void>;
  loop(): void;
  stop(): void;
  destroy(): void;
}
