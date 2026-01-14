/**
 * Core specification types for medli
 *
 * This module uses TypeBox for schema definitions with type inference.
 * Types are derived from schemas using Static<typeof Schema>.
 */

import { Type, Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// ============================================================================
// PHASE 1: PRIMITIVE SCHEMAS
// ============================================================================

/**
 * A 2D position with x and y coordinates.
 */
export const PositionSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
});
export type Position = Static<typeof PositionSchema>;

/**
 * 2D affine transformation matrix as 6 values [a, b, c, d, e, f].
 * Represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 *
 * Point (x, y) transforms to (ax + cy + e, bx + dy + f).
 * Identity matrix: [1, 0, 0, 1, 0, 0]
 *
 * Note: Schema uses Array for structural validation; semantic validation
 * enforces exactly 6 finite numbers with specific error messages.
 */
export const Matrix2DSchema = Type.Array(Type.Number());
export type Matrix2D = [number, number, number, number, number, number];

/**
 * Scale mode for mapping viewport to element.
 * - 'fit': Uniform scale to fit, letterbox/pillarbox empty space
 * - 'fill': Uniform scale to fill, crop content outside element
 * - 'stretch': Non-uniform scale to exactly fill (distorts aspect ratio)
 */
export const ScaleModeSchema = Type.Union([
  Type.Literal("fit"),
  Type.Literal("fill"),
  Type.Literal("stretch"),
]);
export type ScaleMode = Static<typeof ScaleModeSchema>;

// ============================================================================
// PHASE 1: SHAPE SCHEMAS
// ============================================================================

/**
 * A circle shape with center position and radius.
 * Style (fill, stroke) inherited from parent Material.
 */
export const CircleSchema = Type.Object({
  type: Type.Literal("circle"),
  center: PositionSchema,
  radius: Type.Number(),
});
export type Circle = Static<typeof CircleSchema>;

/**
 * A line shape from start to end position.
 * Style (stroke, strokeWidth) inherited from parent Material.
 */
export const LineSchema = Type.Object({
  type: Type.Literal("line"),
  start: PositionSchema,
  end: PositionSchema,
});
export type Line = Static<typeof LineSchema>;

/**
 * A rectangle shape with center position and dimensions.
 * Style (fill, stroke, strokeWidth) inherited from parent Material.
 */
export const RectangleSchema = Type.Object({
  type: Type.Literal("rectangle"),
  center: PositionSchema,
  width: Type.Number(),
  height: Type.Number(),
});
export type Rectangle = Static<typeof RectangleSchema>;

/**
 * Defines a rectangular region within the source image for cropping.
 * Coordinates and dimensions are in source image pixels.
 */
export const ImageCropSchema = Type.Object({
  /** Source x position in pixels (must be >= 0) */
  x: Type.Number(),
  /** Source y position in pixels (must be >= 0) */
  y: Type.Number(),
  /** Source width in pixels (must be > 0) */
  width: Type.Number(),
  /** Source height in pixels (must be > 0) */
  height: Type.Number(),
});
export type ImageCrop = Static<typeof ImageCropSchema>;

/**
 * An image shape positioned in viewport coordinates.
 * URL references an external image resource loaded by the renderer.
 */
export const ImageSchema = Type.Object({
  type: Type.Literal("image"),
  url: Type.String(),
  position: PositionSchema,
  width: Type.Number(),
  height: Type.Number(),
  /** Optional source rectangle for cropping. When present, only this region of the source image is rendered. */
  crop: Type.Optional(ImageCropSchema),
});
export type Image = Static<typeof ImageSchema>;

/**
 * Union of all shape types.
 */
export const ShapeSchema = Type.Union([
  CircleSchema,
  LineSchema,
  RectangleSchema,
  ImageSchema,
]);
export type Shape = Static<typeof ShapeSchema>;

// ============================================================================
// PHASE 2: MATERIAL SCHEMAS
// ============================================================================

/**
 * Root material with all style properties required.
 * Must be the root of the Frame tree.
 * Note: children use Type.Array(Type.Any()) here and are properly typed in FrameNodeSchema.
 */
export const RootMaterialSchema = Type.Object({
  type: Type.Literal("material"),
  id: Type.String(),
  fill: Type.String(),
  stroke: Type.String(),
  strokeWidth: Type.Number(),
  children: Type.Array(Type.Any()),
});
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
export const ChildMaterialSchema = Type.Object({
  type: Type.Literal("material"),
  id: Type.String(),
  ref: Type.String(),
  fill: Type.Optional(Type.String()),
  stroke: Type.Optional(Type.String()),
  strokeWidth: Type.Optional(Type.Number()),
  children: Type.Array(Type.Any()),
});
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

// ============================================================================
// PHASE 2: TRANSFORM SCHEMA
// ============================================================================

/**
 * A transform node applying a 2D affine transformation to its children.
 * Transforms accumulate via matrix multiplication during traversal.
 * To express identity, simply omit the Transform node entirely.
 */
export const TransformSchema = Type.Object({
  type: Type.Literal("transform"),
  matrix: Matrix2DSchema,
  children: Type.Array(Type.Any()),
});
export type Transform = {
  type: "transform";
  matrix: Matrix2D;
  children: FrameNode[];
};

// ============================================================================
// PHASE 2: RECURSIVE FRAME NODE SCHEMA
// ============================================================================

/**
 * A node in the frame tree - material (style), transform (geometry), or shape (leaf).
 * Uses Type.Recursive for the recursive tree structure.
 */
export const FrameNodeSchema = Type.Recursive((This) =>
  Type.Union([
    // RootMaterial
    Type.Object({
      type: Type.Literal("material"),
      id: Type.String(),
      fill: Type.String(),
      stroke: Type.String(),
      strokeWidth: Type.Number(),
      children: Type.Array(This),
    }),
    // ChildMaterial
    Type.Object({
      type: Type.Literal("material"),
      id: Type.String(),
      ref: Type.String(),
      fill: Type.Optional(Type.String()),
      stroke: Type.Optional(Type.String()),
      strokeWidth: Type.Optional(Type.Number()),
      children: Type.Array(This),
    }),
    // Transform
    Type.Object({
      type: Type.Literal("transform"),
      matrix: Matrix2DSchema,
      children: Type.Array(This),
    }),
    // Shapes (leaves)
    CircleSchema,
    LineSchema,
    RectangleSchema,
    ImageSchema,
  ])
);
export type FrameNode = Material | Transform | Shape;

// ============================================================================
// PHASE 2: VIEWPORT AND FRAME SCHEMAS
// ============================================================================

/**
 * Viewport defines the logical coordinate space for rendering.
 * Origin is at center (0,0) with Y-up convention.
 * X ranges from -halfWidth to +halfWidth.
 * Y ranges from -halfHeight to +halfHeight.
 */
export const ViewportSchema = Type.Object({
  /** Half the viewport width. X ranges from -halfWidth to +halfWidth. */
  halfWidth: Type.Number(),
  /** Half the viewport height. Y ranges from -halfHeight to +halfHeight. */
  halfHeight: Type.Number(),
  /** How viewport maps to differently-sized elements. */
  scaleMode: ScaleModeSchema,
});
export type Viewport = Static<typeof ViewportSchema>;

/**
 * A frame represents the current state to render.
 * Contains a Material-based tree where root has all style properties defined.
 */
export const FrameSchema = Type.Object({
  /** Viewport configuration (required). */
  viewport: ViewportSchema,
  /**
   * Background color for the frame.
   * - When present: Clear rendered contents and fill with this color before rendering shapes.
   * - When absent (undefined): Preserve previous frame contents, render new shapes on top.
   */
  background: Type.Optional(Type.String()),
  root: Type.Object({
    type: Type.Literal("material"),
    id: Type.String(),
    fill: Type.String(),
    stroke: Type.String(),
    strokeWidth: Type.Number(),
    children: Type.Array(FrameNodeSchema),
  }),
});
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

// ============================================================================
// PHASE 2: FRAGMENT SCHEMAS
// ============================================================================

/**
 * A reference to an external material that provides style properties.
 * Forms the root of a Fragment - has an ID but no style properties.
 * During resolution, ChildMaterials referencing this ID get rewritten
 * to reference the embedding material (Embed.rootMaterialId).
 */
export const RootMaterialRefSchema = Type.Object({
  type: Type.Literal("root-material-ref"),
  /**
   * Internal ID for the fragment's material anchor.
   * ChildMaterials within the fragment ref this ID to inherit from
   * whatever material this fragment gets embedded into.
   */
  id: Type.String(),
  children: Type.Array(FrameNodeSchema),
});
export type RootMaterialRef = {
  type: "root-material-ref";
  /**
   * Internal ID for the fragment's material anchor.
   * ChildMaterials within the fragment ref this ID to inherit from
   * whatever material this fragment gets embedded into.
   */
  id: string;
  children: FrameNode[];
};

/**
 * A composable scene graph that can be embedded into Frames or other Fragments.
 * Nearly identical to Frame, but:
 * - Has RootMaterialRef instead of RootMaterial (needs external style context)
 * - Has no viewport (client provides coordinate space)
 */
export const FragmentSchema = Type.Object({
  /**
   * The fragment's root node - a reference to an external material.
   * Contains the fragment's content as children.
   */
  root: RootMaterialRefSchema,
});
export type Fragment = {
  /**
   * The fragment's root node - a reference to an external material.
   * Contains the fragment's content as children.
   */
  root: RootMaterialRef;
};

/**
 * Embeds a Fragment into the parent tree.
 * Controls namespace (for ID uniqueness) and material binding (for style inheritance).
 * Resolved before rendering - renderers never see Embed nodes.
 */
export const EmbedSchema = Type.Object({
  type: Type.Literal("embed"),
  /**
   * Namespace prefix for all material IDs in the fragment.
   * Prevents ID collisions when embedding the same fragment multiple times.
   * Must be a valid identifier: starts with letter, contains only letters and numbers.
   * IMPORTANT: Underscores are NOT allowed to prevent ambiguity with namespace separator.
   */
  namespace: Type.String(),
  /**
   * Material ID that the fragment's RootMaterialRef resolves to.
   * Must be an ancestor material in the tree where this Embed appears.
   */
  rootMaterialId: Type.String(),
  /**
   * The fragment to embed.
   */
  fragment: FragmentSchema,
});
export type Embed = Static<typeof EmbedSchema> & {
  fragment: Fragment;
};

/**
 * Extended FrameNode that includes Embed (used only during generation, before resolution).
 */
export const UnresolvedFrameNodeSchema = Type.Union([
  FrameNodeSchema,
  EmbedSchema,
]);
export type UnresolvedFrameNode = FrameNode | Embed;

// ============================================================================
// PHASE 3: VALIDATION
// ============================================================================

/**
 * Result of frame validation.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

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
 * Schema for validating top-level frame structure (viewport and root existence).
 * Tree node validation is handled by semantic validation for better error messages.
 */
const FrameTopLevelSchema = Type.Object({
  viewport: ViewportSchema,
  background: Type.Optional(Type.String()),
  root: Type.Object({
    type: Type.Literal("material"),
    id: Type.String(),
    fill: Type.String(),
    stroke: Type.String(),
    strokeWidth: Type.Number(),
    children: Type.Array(Type.Any()), // Children validated semantically
  }),
});

/**
 * Validate frame structure using TypeBox schema.
 * Checks: correct types, required fields present at top level.
 * Tree node validation deferred to semantic validation for better error messages.
 */
export function validateFrameStructure(data: unknown): ValidationResult {
  // Check for missing viewport first (specific error message)
  if (
    typeof data !== "object" ||
    data === null ||
    !("viewport" in data) ||
    data.viewport === undefined
  ) {
    return { valid: false, error: "Frame missing required property: viewport" };
  }

  // Check for invalid scaleMode (specific error message)
  const frame = data as {
    viewport?: {
      scaleMode?: unknown;
      halfWidth?: unknown;
      halfHeight?: unknown;
    };
  };
  if (
    frame.viewport &&
    typeof frame.viewport.scaleMode === "string" &&
    !["fit", "fill", "stretch"].includes(frame.viewport.scaleMode)
  ) {
    return {
      valid: false,
      error: "Viewport scaleMode must be 'fit', 'fill', or 'stretch'",
    };
  }

  // Check viewport dimensions for NaN/Infinity before TypeBox (TypeBox rejects these)
  // We want semantic validation to handle these with better error messages
  if (frame.viewport) {
    const hw = frame.viewport.halfWidth;
    const hh = frame.viewport.halfHeight;
    if (typeof hw === "number" && !isFinite(hw)) {
      // Pass through to semantic validation - it will give a specific error
      // But TypeBox would reject NaN/Infinity, so we skip TypeBox for this case
      return { valid: true };
    }
    if (typeof hh === "number" && !isFinite(hh)) {
      return { valid: true };
    }
  }

  // Check root material properties (specific error messages)
  const rootData = (data as { root?: Record<string, unknown> }).root;
  if (rootData) {
    if (rootData.fill === undefined) {
      return {
        valid: false,
        error: "Root material missing required property: fill",
      };
    }
    if (rootData.stroke === undefined) {
      return {
        valid: false,
        error: "Root material missing required property: stroke",
      };
    }
    if (rootData.strokeWidth === undefined) {
      return {
        valid: false,
        error: "Root material missing required property: strokeWidth",
      };
    }
  }

  // Use TypeBox for remaining structural validation
  if (!Value.Check(FrameTopLevelSchema, data)) {
    const errors = [...Value.Errors(FrameTopLevelSchema, data)];
    const firstError = errors[0];
    if (firstError) {
      return {
        valid: false,
        error: `${firstError.path}: ${firstError.message}`,
      };
    }
    return { valid: false, error: "Invalid frame structure" };
  }
  return { valid: true };
}

/**
 * Validate frame semantics (ID uniqueness, ancestor refs, positive dimensions).
 * Assumes structural validation has passed.
 */
export function validateFrameSemantics(frame: Frame): ValidationResult {
  // Validate viewport dimensions are positive and finite
  if (frame.viewport.halfWidth <= 0 || !isFinite(frame.viewport.halfWidth)) {
    return {
      valid: false,
      error: "Viewport halfWidth must be a positive finite number",
    };
  }
  if (frame.viewport.halfHeight <= 0 || !isFinite(frame.viewport.halfHeight)) {
    return {
      valid: false,
      error: "Viewport halfHeight must be a positive finite number",
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
      // Validate matrix has exactly 6 values
      if (node.matrix.length !== 6) {
        return {
          valid: false,
          error: `Transform matrix must have exactly 6 values, got ${node.matrix.length}`,
        };
      }
      // Validate matrix values are finite
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
      if (node.url.length === 0) {
        return {
          valid: false,
          error: "Image url must be a non-empty string",
        };
      }
      // Validate width is positive finite number
      if (node.width <= 0 || !isFinite(node.width)) {
        return {
          valid: false,
          error: "Image width must be a positive finite number",
        };
      }
      // Validate height is positive finite number
      if (node.height <= 0 || !isFinite(node.height)) {
        return {
          valid: false,
          error: "Image height must be a positive finite number",
        };
      }
      // Validate crop properties if present
      if (node.crop !== undefined) {
        // crop.x must be a finite number >= 0
        if (node.crop.x < 0 || !isFinite(node.crop.x)) {
          return {
            valid: false,
            error: "Image crop.x must be a non-negative finite number",
          };
        }
        // crop.y must be a finite number >= 0
        if (node.crop.y < 0 || !isFinite(node.crop.y)) {
          return {
            valid: false,
            error: "Image crop.y must be a non-negative finite number",
          };
        }
        // crop.width must be a positive finite number
        if (node.crop.width <= 0 || !isFinite(node.crop.width)) {
          return {
            valid: false,
            error: "Image crop.width must be a positive finite number",
          };
        }
        // crop.height must be a positive finite number
        if (node.crop.height <= 0 || !isFinite(node.crop.height)) {
          return {
            valid: false,
            error: "Image crop.height must be a positive finite number",
          };
        }
      }
    }
    // Other shapes (circle, line, rectangle) are leaves - no additional validation needed
    return { valid: true };
  }

  // Start from root
  return validateNode(frame.root, new Set());
}

/**
 * Validate a frame's material tree structure.
 * Checks: unique IDs, valid ancestor refs, root completeness.
 * Single-pass, top-to-bottom traversal.
 *
 * Uses two-layer validation: structure (TypeBox) then semantics (custom).
 */
export function validateFrame(frame: Frame): ValidationResult {
  // Layer 1: Structural validation via TypeBox
  const structureResult = validateFrameStructure(frame);
  if (!structureResult.valid) return structureResult;

  // Layer 2: Semantic validation (business rules)
  return validateFrameSemantics(frame);
}

/**
 * Schema for validating top-level fragment structure.
 * Tree node validation is handled by semantic validation for better error messages.
 */
const FragmentTopLevelSchema = Type.Object({
  root: Type.Object({
    type: Type.Literal("root-material-ref"),
    id: Type.String(),
    children: Type.Array(Type.Any()), // Children validated semantically
  }),
});

/**
 * Validate fragment structure using TypeBox schema.
 * Checks: correct types, required fields present at top level.
 * Tree node validation deferred to semantic validation for better error messages.
 */
export function validateFragmentStructure(data: unknown): ValidationResult {
  if (!Value.Check(FragmentTopLevelSchema, data)) {
    const errors = [...Value.Errors(FragmentTopLevelSchema, data)];
    const firstError = errors[0];
    if (firstError) {
      return {
        valid: false,
        error: `${firstError.path}: ${firstError.message}`,
      };
    }
    return { valid: false, error: "Invalid fragment structure" };
  }
  return { valid: true };
}

/**
 * Validate fragment semantics (ID uniqueness, ancestor refs, etc.).
 * Assumes structural validation has passed.
 */
export function validateFragmentSemantics(
  fragment: Fragment
): ValidationResult {
  // 1. RootMaterialRef must have non-empty ID
  if (!fragment.root.id || fragment.root.id.length === 0) {
    return { valid: false, error: "RootMaterialRef must have a non-empty ID" };
  }

  // 2. Early return for empty fragments (valid but no-op)
  if (fragment.root.children.length === 0) {
    return { valid: true };
  }

  // Track material IDs for uniqueness
  const seenIds = new Set<string>();
  // Track namespaces for embed uniqueness within scope
  const usedNamespaces = new Set<string>();

  function checkNode(
    node: FrameNode | Embed,
    ancestorIds: Set<string>
  ): ValidationResult {
    if (node.type === "material") {
      // Unique ID check
      if (seenIds.has(node.id)) {
        return { valid: false, error: `Duplicate material ID: ${node.id}` };
      }
      seenIds.add(node.id);

      // Ancestor ref check (for ChildMaterial)
      if ("ref" in node && !ancestorIds.has(node.ref)) {
        return {
          valid: false,
          error: `Material "${node.id}" references non-ancestor: "${node.ref}"`,
        };
      }

      // Recurse with this material added to ancestors
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);
      for (const child of node.children) {
        const result = checkNode(child as FrameNode | Embed, newAncestors);
        if (!result.valid) return result;
      }
    } else if (node.type === "transform") {
      // Validate matrix has exactly 6 values
      if (node.matrix.length !== 6) {
        return {
          valid: false,
          error: `Transform matrix must have exactly 6 values, got ${node.matrix.length}`,
        };
      }
      // Validate matrix values are finite
      for (let i = 0; i < 6; i++) {
        if (typeof node.matrix[i] !== "number" || !isFinite(node.matrix[i])) {
          return {
            valid: false,
            error: `Transform matrix[${i}] must be a finite number`,
          };
        }
      }
      // Recurse (transforms don't add to ancestor materials)
      for (const child of node.children) {
        const result = checkNode(child as FrameNode | Embed, ancestorIds);
        if (!result.valid) return result;
      }
    } else if (node.type === "embed") {
      // Validate embed
      const embedResult = validateEmbed(node, ancestorIds, usedNamespaces);
      if (!embedResult.valid) return embedResult;
      usedNamespaces.add(node.namespace);
    } else if (node.type === "image") {
      // Validate image URL is non-empty string
      if (node.url.length === 0) {
        return {
          valid: false,
          error: "Image url must be a non-empty string",
        };
      }
      // Validate width is positive finite number
      if (node.width <= 0 || !isFinite(node.width)) {
        return {
          valid: false,
          error: "Image width must be a positive finite number",
        };
      }
      // Validate height is positive finite number
      if (node.height <= 0 || !isFinite(node.height)) {
        return {
          valid: false,
          error: "Image height must be a positive finite number",
        };
      }
      // Validate crop properties if present
      if (node.crop !== undefined) {
        // crop.x must be a finite number >= 0
        if (node.crop.x < 0 || !isFinite(node.crop.x)) {
          return {
            valid: false,
            error: "Image crop.x must be a non-negative finite number",
          };
        }
        // crop.y must be a finite number >= 0
        if (node.crop.y < 0 || !isFinite(node.crop.y)) {
          return {
            valid: false,
            error: "Image crop.y must be a non-negative finite number",
          };
        }
        // crop.width must be a positive finite number
        if (node.crop.width <= 0 || !isFinite(node.crop.width)) {
          return {
            valid: false,
            error: "Image crop.width must be a positive finite number",
          };
        }
        // crop.height must be a positive finite number
        if (node.crop.height <= 0 || !isFinite(node.crop.height)) {
          return {
            valid: false,
            error: "Image crop.height must be a positive finite number",
          };
        }
      }
    }
    // Other shapes pass through
    return { valid: true };
  }

  // Start with RootMaterialRef.id as the only ancestor
  const initialAncestors = new Set([fragment.root.id]);
  for (const child of fragment.root.children) {
    const result = checkNode(child as FrameNode | Embed, initialAncestors);
    if (!result.valid) return result;
  }

  return { valid: true };
}

/**
 * Validate a fragment's structure.
 * Checks: RootMaterialRef has non-empty ID, unique material IDs,
 * valid ancestor refs, valid transform matrices, valid embedded fragments.
 *
 * Uses two-layer validation: structure (TypeBox) then semantics (custom).
 */
export function validateFragment(fragment: Fragment): ValidationResult {
  // Layer 1: Structural validation via TypeBox
  const structureResult = validateFragmentStructure(fragment);
  if (!structureResult.valid) return structureResult;

  // Layer 2: Semantic validation (business rules)
  return validateFragmentSemantics(fragment);
}

/**
 * Validate an embed node.
 * Checks: valid namespace format, no namespace collision, valid rootMaterialId,
 * and recursively validates the embedded fragment.
 */
export function validateEmbed(
  embed: Embed,
  ancestorMaterialIds: Set<string>,
  usedNamespaces: Set<string>
): ValidationResult {
  // 1. Namespace must be valid identifier (NO underscores - reserved for separator)
  if (!embed.namespace || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(embed.namespace)) {
    return {
      valid: false,
      error:
        "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
    };
  }

  // 2. Namespace must not collide
  if (usedNamespaces.has(embed.namespace)) {
    return {
      valid: false,
      error: `Namespace "${embed.namespace}" already used in this scope`,
    };
  }

  // 3. rootMaterialId must be an ancestor
  if (!ancestorMaterialIds.has(embed.rootMaterialId)) {
    return {
      valid: false,
      error: `rootMaterialId "${embed.rootMaterialId}" is not an ancestor material`,
    };
  }

  // 4. Fragment itself must be valid
  return validateFragment(embed.fragment);
}

// ============================================================================
// PHASE 4: JSON SCHEMA EXPORTS
// ============================================================================

/**
 * Get a plain JSON Schema object from a TypeBox schema.
 * Useful for serialization and external tooling.
 */
export function getJsonSchema(schema: TSchema): object {
  return JSON.parse(JSON.stringify(schema));
}

// Re-export schemas for JSON Schema generation
// All schemas are already exported above with Schema suffix

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// RUNTIME INTERFACES (NOT serializable - no schemas needed)
// ============================================================================

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
 * Interface for objects that can produce Fragments.
 * Enables composition across different generator types.
 */
export interface FragmentGenerator {
  /**
   * Generate a Fragment for the given render context.
   * @param context - The rendering context (provides time, etc.)
   * @returns A Fragment that can be embedded into a Frame or another Fragment
   */
  fragment(context: RenderContext): Fragment;
}

/**
 * Base performance metrics common to ALL renderers.
 * Represents timing and counts that are universally measurable.
 * All timing values are in milliseconds.
 */
export interface BaseRendererMetrics {
  /** Total time for render() call in milliseconds */
  frameTime: number;
  /** Time for generator.frame() execution in milliseconds */
  generatorTime: number;
  /** Time to traverse frame tree and collect shapes in milliseconds */
  traversalTime: number;
  /** Time for resource loading/resolution in milliseconds */
  resourceTime: number;
  /** Time for actual rendering (DOM/GPU submission) in milliseconds */
  renderTime: number;
  /** Total frames rendered since renderer creation */
  frameCount: number;
  /** Rolling average FPS (undefined when not looping) */
  fps: number | undefined;
  /** Total shapes in current frame */
  shapeCount: number;
  /** DOMHighResTimeStamp of last render start */
  lastFrameTimestamp: DOMHighResTimeStamp;
}

/**
 * @deprecated Use BaseRendererMetrics or renderer-specific metrics types.
 * This type includes GPU-specific fields that don't apply to all renderers.
 * Maintained for Phase 1 backwards compatibility.
 */
export type RendererMetrics = BaseRendererMetrics & {
  /** @deprecated Use renderer-specific metrics type for GPU timing */
  gpuTime: number | undefined;
  /** @deprecated Use renderer-specific metrics type for batch counts */
  batchCount: number;
};

/**
 * Renderer displays frames to the screen.
 * Renders content in the Frame's viewport coordinate system.
 * Queries element size on each render and maps viewport to element based on scaleMode.
 * Constructors accept HTML elements of the relevant type.
 * Expects requestAnimationFrame support.
 *
 * Generic on metrics type to allow renderer-specific metrics.
 * Uses BaseRendererMetrics as default for backwards compatibility.
 *
 * @typeParam M - Metrics type extending BaseRendererMetrics
 */
export interface Renderer<M extends BaseRendererMetrics = BaseRendererMetrics> {
  /** Performance metrics for the last rendered frame */
  readonly metrics: M;
  render(time: number): Promise<void>;
  loop(): void;
  stop(): void;
  destroy(): void;
}

// ============================================================================
// EMBED AND FRAGMENT RESOLUTION
// ============================================================================

/**
 * Resolve a single Embed node into FrameNodes.
 * Namespaces material IDs and rewrites refs.
 * @param embed - The embed node to resolve
 * @param ancestorMaterialIds - Set of material IDs that are ancestors in the tree
 * @returns Array of FrameNodes with namespaced IDs
 * @throws Error if rootMaterialId is not an ancestor
 */
export function resolveEmbed(
  embed: Embed,
  ancestorMaterialIds: Set<string>
): FrameNode[] {
  const { namespace, rootMaterialId, fragment } = embed;
  const rootRefId = fragment.root.id;

  // Validate rootMaterialId is an ancestor
  if (!ancestorMaterialIds.has(rootMaterialId)) {
    throw new Error(
      `Embed rootMaterialId "${rootMaterialId}" is not an ancestor material`
    );
  }

  // Track material IDs created during this resolution for nested embed validation
  const createdMaterialIds = new Set<string>();

  // processNode returns FrameNode[] for consistency - non-embed cases return single-element arrays,
  // embed cases return the flattened result of nested resolution
  function processNode(node: FrameNode | Embed): FrameNode[] {
    if (node.type === "material") {
      // Namespace the ID
      const namespacedId = `${namespace}_${node.id}`;
      createdMaterialIds.add(namespacedId);

      // Rewrite ref: ALL material refs get namespaced EXCEPT refs to RootMaterialRef
      // - If node.ref === rootRefId -> rewrite to rootMaterialId (the embedding context's material)
      // - Otherwise -> rewrite to ${namespace}_${node.ref} (another material within the fragment)
      let resolvedRef: string;
      if ("ref" in node) {
        resolvedRef =
          node.ref === rootRefId ? rootMaterialId : `${namespace}_${node.ref}`;
      }

      // Create the resolved material
      const result: ChildMaterial = {
        type: "material",
        id: namespacedId,
        ref: resolvedRef!,
        children: node.children.flatMap((c) =>
          processNode(c as FrameNode | Embed)
        ),
      };

      // Copy any style overrides
      if ((node as ChildMaterial).fill !== undefined)
        result.fill = (node as ChildMaterial).fill;
      if ((node as ChildMaterial).stroke !== undefined)
        result.stroke = (node as ChildMaterial).stroke;
      if ((node as ChildMaterial).strokeWidth !== undefined)
        result.strokeWidth = (node as ChildMaterial).strokeWidth;

      return [result];
    } else if (node.type === "transform") {
      return [
        {
          type: "transform",
          matrix: node.matrix,
          children: node.children.flatMap((c) =>
            processNode(c as FrameNode | Embed)
          ),
        },
      ];
    } else if (node.type === "embed") {
      // Recursive resolution - namespace compounds
      const nestedNamespace = `${namespace}_${node.namespace}`;
      const nestedRootId =
        node.rootMaterialId === rootRefId
          ? rootMaterialId
          : `${namespace}_${node.rootMaterialId}`;

      // Build ancestor set for nested embed: original ancestors + newly created materials
      const nestedAncestors = new Set(ancestorMaterialIds);
      for (const id of createdMaterialIds) {
        nestedAncestors.add(id);
      }

      // Process the nested embed immediately (flatten)
      return resolveEmbed(
        { ...node, namespace: nestedNamespace, rootMaterialId: nestedRootId },
        nestedAncestors
      );
    } else {
      // Shape - pass through unchanged (returns single-element array)
      return [node];
    }
  }

  // Process RootMaterialRef's children (not the RootMaterialRef itself)
  // This is where the "removal" happens - we return children, not the ref
  return fragment.root.children.flatMap((c) =>
    processNode(c as FrameNode | Embed)
  );
}

/**
 * Resolve all Embed nodes in a Frame, producing a Frame with only FrameNodes.
 * @param frame - The frame to resolve (may contain Embed nodes in its tree)
 * @returns A new Frame with all Embed nodes resolved
 */
export function resolveFrame(frame: Frame): Frame {
  function resolveNode(
    node: FrameNode | Embed,
    ancestorIds: Set<string>
  ): FrameNode[] {
    if (node.type === "embed") {
      return resolveEmbed(node, ancestorIds);
    } else if (node.type === "material") {
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);

      if ("ref" in node) {
        // ChildMaterial
        const childMaterial = node as ChildMaterial;
        const result: ChildMaterial = {
          type: "material",
          id: childMaterial.id,
          ref: childMaterial.ref,
          children: childMaterial.children.flatMap((c) =>
            resolveNode(c as FrameNode | Embed, newAncestors)
          ),
        };

        // Copy style overrides
        if (childMaterial.fill !== undefined) result.fill = childMaterial.fill;
        if (childMaterial.stroke !== undefined)
          result.stroke = childMaterial.stroke;
        if (childMaterial.strokeWidth !== undefined)
          result.strokeWidth = childMaterial.strokeWidth;

        return [result];
      } else {
        // RootMaterial (shouldn't happen except at root, but handle it)
        const rootMaterial = node as RootMaterial;
        return [
          {
            type: "material",
            id: rootMaterial.id,
            fill: rootMaterial.fill,
            stroke: rootMaterial.stroke,
            strokeWidth: rootMaterial.strokeWidth,
            children: rootMaterial.children.flatMap((c) =>
              resolveNode(c as FrameNode | Embed, newAncestors)
            ),
          },
        ];
      }
    } else if (node.type === "transform") {
      return [
        {
          type: "transform",
          matrix: node.matrix,
          children: node.children.flatMap((c) =>
            resolveNode(c as FrameNode | Embed, ancestorIds)
          ),
        },
      ];
    } else {
      // Shape - pass through
      return [node];
    }
  }

  const resolvedRoot: RootMaterial = {
    type: "material",
    id: frame.root.id,
    fill: frame.root.fill,
    stroke: frame.root.stroke,
    strokeWidth: frame.root.strokeWidth,
    children: frame.root.children.flatMap((c) =>
      resolveNode(c as FrameNode | Embed, new Set([frame.root.id]))
    ),
  };

  return {
    viewport: frame.viewport,
    background: frame.background,
    root: resolvedRoot,
  };
}

/**
 * Convert a Fragment to a standalone Frame.
 * Rewrites refs pointing to RootMaterialRef.id to point to the new rootId.
 * @param fragment - The fragment to convert
 * @param viewport - The viewport for the resulting frame
 * @param defaultMaterial - Style properties for the root material
 * @param rootId - Optional ID for the root material (defaults to "root")
 */
export function fragmentToFrame(
  fragment: Fragment,
  viewport: Viewport,
  defaultMaterial: { fill: string; stroke: string; strokeWidth: number },
  rootId: string = "root"
): Frame {
  const fragRootId = fragment.root.id;

  // Rewrite refs that point to the fragment's RootMaterialRef
  function rewriteRefs(node: FrameNode): FrameNode {
    if (node.type === "material" && "ref" in node) {
      const childMaterial = node as ChildMaterial;
      const newRef =
        childMaterial.ref === fragRootId ? rootId : childMaterial.ref;
      const result: ChildMaterial = {
        type: "material",
        id: childMaterial.id,
        ref: newRef,
        children: childMaterial.children.map(rewriteRefs),
      };

      // Copy style overrides
      if (childMaterial.fill !== undefined) result.fill = childMaterial.fill;
      if (childMaterial.stroke !== undefined)
        result.stroke = childMaterial.stroke;
      if (childMaterial.strokeWidth !== undefined)
        result.strokeWidth = childMaterial.strokeWidth;

      return result;
    } else if (node.type === "transform") {
      return {
        type: "transform",
        matrix: node.matrix,
        children: node.children.map(rewriteRefs),
      };
    }
    return node;
  }

  const root: RootMaterial = {
    type: "material",
    id: rootId,
    fill: defaultMaterial.fill,
    stroke: defaultMaterial.stroke,
    strokeWidth: defaultMaterial.strokeWidth,
    children: fragment.root.children.map(rewriteRefs),
  };

  return { viewport, root };
}
