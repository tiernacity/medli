# Fragment Design: Composable Generators (v3)

## Core Insight: Fragment ≈ Frame

**Fragment is nearly identical to Frame.** The ONLY differences:

> **Immutability Note:** Fragment objects should be treated as immutable. Multiple Embed nodes can safely reference the same Fragment object without causing issues during resolution.

| Property | Frame | Fragment |
|----------|-------|----------|
| Root node | `RootMaterial` (has fill, stroke, strokeWidth) | `RootMaterialRef` (no styles - refs external material) |
| Viewport | Required | None |

Everything else is identical. Fragment uses the same `FrameNode` types for its tree. This minimal difference enables composition while maintaining type safety.

**Separation of concerns:**
- Generators produce *structure* (shapes, transforms, material hierarchy)
- Client code handles *everything else* (animation, coordinate spaces, timing, context)

## Summary

Fragment enables generator composition. A Fragment's root is a `RootMaterialRef` - a reference to an external material that provides styles. When embedded via an `Embed` node, the ref resolves to the embedding context's material.

**Key design decisions:**
- `RootMaterialRef` is a placeholder that references an external material for styles
- `Embed` node specifies namespace (for ID uniqueness) and rootMaterialId (for style inheritance)
- Fragment resolution happens before rendering (like optimization)
- Renderers never see Embed nodes - they receive pure Frames

## Problem Statement

Currently, medli has a strict constraint: each Frame must have a fully-compliant material tree with a RootMaterial that defines all style properties. This means:

1. **Single generator per scene**: Client code must use exactly one generator to create an entire scene
2. **No composition**: Generators cannot delegate sub-scene creation to other generators
3. **Tight coupling**: Reusable visual components cannot be created as independent generators
4. **Style inflexibility**: Components cannot inherit styles from their embedding context

Example of the current limitation:

```typescript
// Current: One generator creates everything
const gen = new ProceduralGenerator((p) => {
  p.viewport(200, 200);
  p.fill("#ff0000");
  p.circle(0, 0, 50);
  // Must manually implement all sub-scenes here
  // Cannot compose from other generators
});

// Desired: Compose from multiple generators
const starGen = createStarFragment();
const cloudGen = createCloudFragment();

const scene = new ProceduralGenerator((p) => {
  p.viewport(200, 200);
  p.fill("#ffff00");
  p.embed(starGen); // Star inherits yellow fill
  p.fill("#ffffff");
  p.embed(cloudGen); // Clouds get white fill
});
```

## Design Goals

### Goals

- Enable generator composition without breaking Frame validation
- Allow style inheritance from embedding context to embedded content
- Support transform accumulation across fragment boundaries
- Maintain type safety with clear compile-time errors for invalid operations
- Support arbitrary nesting of fragments within fragments
- Enable cross-generator composition (procedural embedding object, vice versa)
- Preserve insertion order semantics for predictable z-ordering
- Keep renderers simple - they never see Embed nodes

### Non-Goals

- Runtime material ID collision detection (use compile-time/generation-time namespacing)
- Fragment caching or memoization (out of scope for initial design)
- Animation coordination across fragments (client code concern)
- Coordinate space transformations (client code concern)
- Remote fragment loading (generator-remote already handles Frame fetching)

## Type Definitions

### RootMaterialRef - External Material Reference

```typescript
/**
 * A reference to an external material that provides style properties.
 * Forms the root of a Fragment - has an ID but no style properties.
 * During resolution, ChildMaterials referencing this ID get rewritten
 * to reference the embedding material (Embed.rootMaterialId).
 */
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
```

**Design rationale:**
- `RootMaterialRef` is the fragment's anchor point for material inheritance
- It has an ID so ChildMaterials within the fragment can reference it
- It has NO style properties (unlike RootMaterial which has fill, stroke, strokeWidth)
- During resolution, the RootMaterialRef is removed and its children lifted into the parent tree

### Fragment Type

```typescript
/**
 * A composable scene graph that can be embedded into Frames or other Fragments.
 * Nearly identical to Frame, but:
 * - Has RootMaterialRef instead of RootMaterial (needs external style context)
 * - Has no viewport (client provides coordinate space)
 */
export type Fragment = {
  /**
   * The fragment's root node - a reference to an external material.
   * Contains the fragment's content as children.
   */
  root: RootMaterialRef;
};
```

**Design rationale:**
- Fragment is minimal - just a root node
- No viewport (embedding context provides coordinate space)
- No namespace (caller provides via Embed)
- The root.children are standard FrameNodes (Material, Transform, Shape)

### FragmentGenerator Interface

```typescript
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
```

### Embed Node

```typescript
/**
 * Embeds a Fragment into the parent tree.
 * Controls namespace (for ID uniqueness) and material binding (for style inheritance).
 * Resolved before rendering - renderers never see Embed nodes.
 */
export type Embed = {
  type: "embed";
  /**
   * Namespace prefix for all material IDs in the fragment.
   * Prevents ID collisions when embedding the same fragment multiple times.
   * Must be a valid identifier: starts with letter, contains only letters and numbers.
   * IMPORTANT: Underscores are NOT allowed to prevent ambiguity with namespace separator.
   * Valid: "star", "cloud1", "leftPanel"
   * Invalid: "star_1", "_hidden", "my_widget"
   */
  namespace: string;
  /**
   * Material ID that the fragment's RootMaterialRef resolves to.
   * Must be an ancestor material in the tree where this Embed appears.
   * The fragment inherits styles from this material.
   */
  rootMaterialId: string;
  /**
   * The fragment to embed.
   */
  fragment: Fragment;
};
```

**Design rationale:**
- Namespace is caller-controlled, enabling same fragment to be embedded multiple times
- rootMaterialId explicitly declares the inheritance relationship
- Fragment is the payload - the actual content to embed

## Namespace Evaluation: Are They Needed?

### The Problem Namespaces Solve

Consider embedding the same fragment twice:

```typescript
const starFragment = createStarFragment();
// Fragment has internal ChildMaterial with id="highlight"

p.embed(starFragment, "star1"); // highlight -> ???
p.embed(starFragment, "star2"); // highlight -> ???
```

Without namespacing: Both embeds produce a ChildMaterial with `id="highlight"` - **collision!**

With namespacing:
- First embed: `id="star1_highlight"` (namespace `star1` + `_` + id `highlight`)
- Second embed: `id="star2_highlight"` (namespace `star2` + `_` + id `highlight`)
- **Unique IDs, no collision**

> **Underscore Separator:** The `_` character is reserved as the namespace separator. Namespaces themselves cannot contain underscores to prevent ambiguity. For example, `star1_highlight` unambiguously means namespace `star1` with id `highlight`.

### Alternative Considered: Auto-Generated IDs

Could we auto-generate unique IDs instead of requiring caller-specified namespaces?

```typescript
// Option: Auto-generate with incrementing counter
p.embed(starFragment); // highlight -> embed_1_highlight
p.embed(starFragment); // highlight -> embed_2_highlight
```

**Rejected because:**
1. Non-deterministic - IDs change based on embed order
2. Debugging harder - can't predict what ID a material will have
3. No semantic meaning - "embed_1" vs "star1" tells you nothing
4. Cross-generator composition - two generators might create conflicting auto-IDs

### Conclusion: Namespaces ARE Required

Caller-specified namespaces are the right solution because:
1. **Deterministic** - same namespace always produces same prefixed IDs
2. **Semantic** - namespaces can describe what the embed is ("leftStar", "rightStar")
3. **Simple** - just string concatenation during resolution
4. **Debuggable** - seeing "leftStar_highlight" tells you exactly where it came from

## Resolution Semantics: What Happens to RootMaterialRef?

### The Question

When resolving an embedded Fragment, what happens to the `RootMaterialRef` node?

### Answer: RootMaterialRef is REMOVED

The `RootMaterialRef` is removed during resolution. Its children are lifted into the parent tree, and any ChildMaterial that referenced the RootMaterialRef's ID gets its ref rewritten to `Embed.rootMaterialId`.

**Before resolution:**
```
Frame
  RootMaterial id="root"
    ChildMaterial id="red" ref="root"
      EMBED namespace="star" rootMaterialId="red"
        Fragment
          RootMaterialRef id="frag_root"     <-- This gets removed
            ChildMaterial id="glow" ref="frag_root"
              Circle
```

**After resolution:**
```
Frame
  RootMaterial id="root"
    ChildMaterial id="red" ref="root"
      ChildMaterial id="star_glow" ref="red"  <-- ref rewritten, ID prefixed
        Circle
```

**Why removal is correct:**
1. `RootMaterialRef` has no style properties - it contributes nothing to rendering
2. The `ref="frag_root"` → `ref="red"` rewrite captures the inheritance relationship
3. Simpler output - no extra nodes in the resolved tree
4. Matches the mental model: fragment content is *inserted into* the parent, not *wrapped by* a placeholder

### Resolution Algorithm

```typescript
function resolveEmbed(
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
  function processNode(node: FrameNode): FrameNode[] {
    if (node.type === "material") {
      // Namespace the ID
      const namespacedId = `${namespace}_${node.id}`;
      createdMaterialIds.add(namespacedId);

      // Rewrite ref: ALL material refs get namespaced EXCEPT refs to RootMaterialRef
      // - If node.ref === rootRefId → rewrite to rootMaterialId (the embedding context's material)
      // - Otherwise → rewrite to ${namespace}_${node.ref} (another material within the fragment)
      let resolvedRef: string;
      if ("ref" in node) {
        resolvedRef = node.ref === rootRefId
          ? rootMaterialId
          : `${namespace}_${node.ref}`;
      }

      // Create the resolved material
      const result: ChildMaterial = {
        type: "material",
        id: namespacedId,
        ref: resolvedRef!,
        children: node.children.flatMap(processNode),
      };

      // Copy any style overrides
      if (node.fill !== undefined) result.fill = node.fill;
      if (node.stroke !== undefined) result.stroke = node.stroke;
      if (node.strokeWidth !== undefined) result.strokeWidth = node.strokeWidth;

      return [result];
    } else if (node.type === "transform") {
      return [{
        type: "transform",
        matrix: node.matrix,
        children: node.children.flatMap(processNode),
      }];
    } else if (node.type === "embed") {
      // Recursive resolution - namespace compounds
      const nestedNamespace = `${namespace}_${node.namespace}`;
      const nestedRootId = node.rootMaterialId === rootRefId
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
  return fragment.root.children.flatMap(processNode);
}
```

## UnresolvedFrameNode - Is It Needed?

### Analysis

The question: Do we need a separate `UnresolvedFrameNode` type that includes `Embed`?

**Arguments for:**
- Type safety: `Frame` with embeds is structurally different from resolved `Frame`
- Clear API: Functions declare whether they accept unresolved or resolved frames

**Arguments against:**
- Complexity: Another type to understand and maintain
- Conversion overhead: Need to convert between types
- Fragment content: Fragment already uses `FrameNode[]` for children

### Decision: Use Type Parameter or Union

Two options that avoid proliferating types:

**Option A: Extended FrameNode Union (Pre-Resolution Only)**
```typescript
// Used only during generation, before resolution
type UnresolvedFrameNode = FrameNode | Embed;
```

**Option B: Generic Frame**
```typescript
type GenericFrame<N> = { viewport: Viewport; root: ... };
type Frame = GenericFrame<FrameNode>;
type UnresolvedFrame = GenericFrame<UnresolvedFrameNode>;
```

**Recommendation: Option A (minimal)**

Keep it simple. `UnresolvedFrameNode` is only used internally by generators. After `resolveFrame()`, the output is a standard `Frame` with only `FrameNode` types. Renderers and validators never need to know about `UnresolvedFrameNode`.

## Validation Rules

### Material Refs Must Be Ancestors Only

**This applies to BOTH Frame and Fragment validation.**

```typescript
// Frame validation (existing)
function validateFrame(frame: Frame): ValidationResult {
  // ... existing code ...
  // Key rule: ChildMaterial.ref must be an ANCESTOR material ID
  if ("ref" in node && !ancestorIds.has(node.ref)) {
    return {
      valid: false,
      error: `Material "${node.id}" references non-ancestor: "${node.ref}"`,
    };
  }
}

// Fragment validation (new)
function validateFragment(fragment: Fragment): ValidationResult {
  const ancestorIds = new Set<string>([fragment.root.id]);

  function validateNode(node: FrameNode, ancestors: Set<string>): ValidationResult {
    if (node.type === "material" && "ref" in node) {
      // SAME RULE: ref must be an ancestor
      if (!ancestors.has(node.ref)) {
        return {
          valid: false,
          error: `Material "${node.id}" references non-ancestor: "${node.ref}"`,
        };
      }
    }
    // ... rest of validation ...
  }
}
```

**Why ancestor-only:**
1. Prevents cycles in the material inheritance graph
2. Guarantees material resolution terminates
3. Makes inheritance order well-defined (root → leaf)
4. Matches CSS cascade semantics (styles flow down, not sideways)

### Fragment Validation

```typescript
export function validateFragment(fragment: Fragment): ValidationResult {
  // 1. RootMaterialRef must have non-empty ID
  if (!fragment.root.id || fragment.root.id.length === 0) {
    return { valid: false, error: "RootMaterialRef must have a non-empty ID" };
  }

  // 2. Early return for empty fragments (valid but no-op)
  if (fragment.root.children.length === 0) {
    return { valid: true };
  }

  // Track material IDs for uniqueness and ref validation
  const seenIds = new Set<string>();
  // Track namespaces for embed uniqueness
  const usedNamespaces = new Set<string>();

  function checkNode(node: FrameNode, ancestorIds: Set<string>): ValidationResult {
    if (node.type === "material") {
      // Unique ID check
      if (seenIds.has(node.id)) {
        return { valid: false, error: `Duplicate material ID: ${node.id}` };
      }
      seenIds.add(node.id);

      // Ancestor ref check (CRITICAL)
      if ("ref" in node && !ancestorIds.has(node.ref)) {
        return {
          valid: false,
          error: `Material "${node.id}" references non-ancestor: "${node.ref}"`
        };
      }

      // Recurse with this material added to ancestors
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);
      for (const child of node.children) {
        const result = checkNode(child, newAncestors);
        if (!result.valid) return result;
      }
    } else if (node.type === "transform") {
      // Validate matrix
      if (node.matrix.length !== 6) {
        return { valid: false, error: "Transform matrix must have 6 values" };
      }
      for (let i = 0; i < 6; i++) {
        if (typeof node.matrix[i] !== "number" || !isFinite(node.matrix[i])) {
          return { valid: false, error: `Transform matrix[${i}] invalid` };
        }
      }
      // Recurse (transforms don't add to ancestor materials)
      for (const child of node.children) {
        const result = checkNode(child, ancestorIds);
        if (!result.valid) return result;
      }
    } else if (node.type === "embed") {
      // Embedded fragments are validated via validateEmbed
      // This ensures namespace uniqueness and rootMaterialId validity
      const embedResult = validateEmbed(node, ancestorIds, usedNamespaces);
      if (!embedResult.valid) return embedResult;
      usedNamespaces.add(node.namespace);
    } else if (node.type === "image") {
      // Shape validation: Image nodes require valid href
      if (!node.href || node.href.length === 0) {
        return { valid: false, error: "Image shape must have non-empty href" };
      }
      // Validate dimensions
      if (node.width <= 0 || node.height <= 0) {
        return { valid: false, error: "Image shape must have positive width and height" };
      }
    }
    // Other shapes (circle, rect, line, path, polygon, polyline) pass through
    // Their validation is handled by the spec type system
    return { valid: true };
  }

  // Start with RootMaterialRef.id as the only ancestor
  const initialAncestors = new Set([fragment.root.id]);
  for (const child of fragment.root.children) {
    const result = checkNode(child, initialAncestors);
    if (!result.valid) return result;
  }

  return { valid: true };
}
```

### Embed Validation

```typescript
export function validateEmbed(
  embed: Embed,
  ancestorMaterialIds: Set<string>,
  usedNamespaces: Set<string>
): ValidationResult {
  // 1. Namespace must be valid identifier (NO underscores - reserved for separator)
  if (!embed.namespace || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(embed.namespace)) {
    return {
      valid: false,
      error: "Embed namespace must start with a letter and contain only letters/numbers (no underscores)"
    };
  }

  // 2. Namespace must not collide with already-used namespaces
  if (usedNamespaces.has(embed.namespace)) {
    return {
      valid: false,
      error: `Namespace "${embed.namespace}" already used in this scope`
    };
  }

  // 3. rootMaterialId must be an ancestor (CRITICAL)
  if (!ancestorMaterialIds.has(embed.rootMaterialId)) {
    return {
      valid: false,
      error: `rootMaterialId "${embed.rootMaterialId}" is not an ancestor material`,
    };
  }

  // 4. Fragment itself must be valid
  return validateFragment(embed.fragment);
}
```

## Processing Pipeline

```
Client Code
    |
Generator (emits Frame with possible Embed nodes)
    |
[Fragment Resolver] (resolves Embed -> FrameNode, required if Embeds present)
    |
[Optimizer] (optional: compact transforms, dedupe materials)
    |
Renderer (validates -> pre-processes -> renders)
    |
Visual Output
```

Fragment resolution is similar to optimization - it's a transformation pass over the IR that happens before rendering.

### When Does Resolution Happen?

Resolution can be triggered in two ways:

1. **By generators internally**: A generator that uses `embed()` internally may resolve all embeds before returning a Frame from `frame()`. This keeps the embedding as an implementation detail.

2. **By client code**: Client code may call `resolveFrame()` explicitly on a Frame that contains Embed nodes. This allows deferred resolution or custom resolution strategies.

**Key Invariant:** Renderers always receive resolved Frames with no Embed nodes. Whether resolution happens inside the generator or in client code, the renderer never needs to handle Embed nodes.

## Material Inheritance Model

### Inheritance Diagram

```
+------------------+
| Frame            |
|  RootMaterial id="root"
|    fill: "#000", stroke: "#000", strokeWidth: 1
|    +-------------+----------------------------------------+
|    |                                                      |
|    | ChildMaterial id="red" ref="root" fill: "#ff0000"    |
|    |   +----------------------------------------------+   |
|    |   |                                              |   |
|    |   | EMBED namespace="stars" rootMaterialId="red" |   |
|    |   |   +--------------------------------------+   |   |
|    |   |   | Fragment                             |   |   |
|    |   |   |   RootMaterialRef id="frag_root"     |   |   |
|    |   |   |     ChildMaterial id="glow"          |   |   |
|    |   |   |       ref="frag_root"                |   |   |
|    |   |   |       stroke: "#ffff00"              |   |   |
|    |   |   |       Circle (0, 0, 10)              |   |   |
|    |   |   +--------------------------------------+   |   |
|    |   +----------------------------------------------+   |
|    +------------------------------------------------------+
+------------------+

AFTER RESOLUTION:

+------------------+
| Frame            |
|  RootMaterial id="root"
|    fill: "#000", stroke: "#000", strokeWidth: 1
|    +------------------------------------------------------+
|    | ChildMaterial id="red" ref="root" fill: "#ff0000"    |
|    |   +----------------------------------------------+   |
|    |   | ChildMaterial id="stars_glow"                |   |
|    |   |   ref="red" <- was "frag_root", now resolved |   |
|    |   |   stroke: "#ffff00"                          |   |
|    |   |     Circle (0, 0, 10)                        |   |
|    |   |   Inherits: fill="#ff0000" from "red"        |   |
|    |   |             strokeWidth=1 from "root"        |   |
|    |   +----------------------------------------------+   |
|    +------------------------------------------------------+
+------------------+
```

The Circle's resolved material is:
- `fill: "#ff0000"` (inherited from "red")
- `stroke: "#ffff00"` (from "stars_glow")
- `strokeWidth: 1` (inherited from "root")

## Transform Accumulation

Transforms compose correctly across fragment boundaries. The existing tree traversal behavior is unchanged - fragment embedding just inserts nodes into the parent tree.

```
Frame coordinate system
|
+-- Transform [translate(100, 0)]
    |
    +-- EMBED Fragment "widget"
        |
        +-- Transform [rotate(45deg)]  <- Fragment's internal transform
            |
            +-- Circle at (0, 0)       <- Rendered at: translate(100,0) * rotate(45) * (0,0)

After resolution:

Frame coordinate system
|
+-- Transform [translate(100, 0)]
    |
    +-- Transform [rotate(45deg)]  <- Lifted from fragment
        |
        +-- Circle at (0, 0)
```

Transform accumulation formula remains: `world = T_parent * T_fragment * P_local`

## Fragment to Frame Conversion

A Fragment can be converted to a standalone Frame by providing:
1. A complete RootMaterial (with all style properties)
2. A Viewport
3. Optionally, a root ID (defaults to "root")

```typescript
/**
 * Convert a Fragment to a standalone Frame.
 * Rewrites any material refs that point to the fragment's RootMaterialRef.id
 * to point to the new rootId instead.
 *
 * @param fragment - The fragment to convert
 * @param viewport - The viewport for the resulting frame
 * @param defaultMaterial - Style properties for the root material
 * @param rootId - Optional ID for the root material (defaults to "root")
 */
function fragmentToFrame(
  fragment: Fragment,
  viewport: Viewport,
  defaultMaterial: { fill: string; stroke: string; strokeWidth: number },
  rootId: string = "root"
): Frame {
  const fragRootId = fragment.root.id;

  // Rewrite refs that point to the fragment's RootMaterialRef
  function rewriteRefs(node: FrameNode): FrameNode {
    if (node.type === "material" && "ref" in node) {
      const newRef = node.ref === fragRootId ? rootId : node.ref;
      return {
        ...node,
        ref: newRef,
        children: node.children.map(rewriteRefs),
      };
    } else if (node.type === "transform") {
      return {
        ...node,
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
```

This enables:
- Fragment preview in isolation
- Testing fragments independently
- Gradual migration from monolithic generators

## Generator API Changes

### Procedural Generator

New methods on the `Sketch` interface:

```typescript
export interface Sketch {
  // ... existing methods ...

  /**
   * Embed a fragment into the current sketch at the current insertion point.
   * The fragment inherits styles from the current material context.
   * @param fragmentGen - A FragmentGenerator or Fragment to embed
   * @param namespace - Unique namespace for this embedding (prevents ID collisions)
   */
  embed(fragmentGen: FragmentGenerator | Fragment, namespace: string): void;

  /**
   * Create a fragment from a draw function.
   * The fragment captures all drawing operations.
   * @param draw - Draw function that defines the fragment content
   * @returns A Fragment that can be embedded
   */
  createFragment(draw: (p: Sketch) => void): Fragment;
}
```

### Object Generator

New `FragmentScene` class and embedding support:

```typescript
/**
 * A scene that produces Fragments instead of Frames.
 */
export class FragmentScene implements FragmentGenerator {
  private children: SceneObject[] = [];

  add(child: SceneObject): this {
    this.children.push(child);
    return this;
  }

  fragment(context: RenderContext): Fragment {
    const root: RootMaterialRef = {
      type: "root-material-ref",
      id: "scene_root",
      children: [],
    };
    // Collect nodes from children
    for (const child of this.children) {
      root.children.push(...child.toNodes(context.time));
    }
    return { root };
  }
}
```

## Edge Cases

### 1. Empty Fragment

```typescript
const emptyFragment: Fragment = {
  root: { type: "root-material-ref", id: "empty", children: [] }
};
// Embeds nothing, valid but no-op
```

### 2. Fragment Reuse (Same Fragment, Multiple Embeds)

```typescript
const gen = new ProceduralGenerator((p) => {
  p.viewport(100, 100);
  const frag = createFragment();

  p.embed(frag, "instance1"); // IDs: instance1_*
  p.embed(frag, "instance2"); // IDs: instance2_*
  // Works! Different namespaces prevent collision
});
```

### 3. Nested Fragments

```typescript
const inner = createInnerFragment(); // root.id = "innerRoot"
const outer = createOuterFragment((frag) => {
  frag.embed(inner, "nested");
}); // root.id = "outerRoot"

// When outer is embedded with namespace "top":
// - outer materials become: top_*
// - inner materials become: top_nested_*
// (compound namespace uses underscore separator between namespace segments)
```

### 4. Fragment with Only Shapes (No Materials)

```typescript
const shapesOnlyFragment: Fragment = {
  root: {
    type: "root-material-ref",
    id: "shapes",
    children: [
      { type: "circle", center: { x: 0, y: 0 }, radius: 10 },
    ],
  },
};
// Valid - shapes inherit from embedding context's current material
```

## Migration / Backward Compatibility

### No Breaking Changes

The Fragment feature is purely additive:

- Existing `Frame` type unchanged
- Existing `Generator` interface unchanged
- Existing `validateFrame()` function unchanged
- Existing renderers unchanged (they receive resolved Frames)
- All existing code continues to work

### New Exports

```typescript
// New types
export type { Fragment, RootMaterialRef, Embed, FragmentGenerator };

// New validation
export { validateFragment, validateEmbed };

// New resolution
export { resolveFrame };

// New generator classes
export { FragmentScene };
```

## Implementation Checklist

### Phase 1: Core Types and Resolution

- [ ] Add `RootMaterialRef` type to `@medli/spec`
- [ ] Add `Fragment` type to `@medli/spec`
- [ ] Add `Embed` type to `@medli/spec`
- [ ] Add `FragmentGenerator` interface to `@medli/spec`
- [ ] Implement `validateFragment()` function
- [ ] Implement `validateEmbed()` function
- [ ] Implement `resolveEmbed()` function
- [ ] Implement `resolveFrame()` function
- [ ] Add `fragmentToFrame()` conversion utility
- [ ] Add unit tests for fragment validation
- [ ] Add unit tests for resolution

### Phase 2: Procedural Generator Support

- [ ] Add `embed()` method to `Sketch` interface
- [ ] Add `createFragment()` method to `Sketch` interface
- [ ] Track current material ID for Embed.rootMaterialId
- [ ] Integrate resolution into `ProceduralGenerator.frame()`
- [ ] Add unit tests for procedural fragment embedding

### Phase 3: Object Generator Support

- [ ] Create `FragmentScene` class
- [ ] Add `embedFragment()` method to `Group` class
- [ ] Add `embed()` method to `Scene` class
- [ ] Integrate resolution into `Scene.frame()`
- [ ] Add unit tests for object fragment embedding

### Phase 4: Cross-Generator Composition

- [ ] Test procedural embedding object fragments
- [ ] Test object embedding procedural fragments
- [ ] Add integration tests for cross-generator composition

### Phase 5: Documentation and Examples

- [ ] Update ARCHITECTURE.md with Fragment section
- [ ] Add Fragment examples to test-app
- [ ] Update AGENT.md files with Fragment guidance

## Test Plan

### Unit Tests

1. **RootMaterialRef Validation**
   - RootMaterialRef with non-empty ID is valid
   - RootMaterialRef with empty ID rejected

2. **Fragment Validation**
   - Valid fragment passes validation
   - Empty fragment (no children) is valid (early return)
   - Duplicate material IDs rejected
   - Invalid transform matrices rejected
   - **Non-ancestor refs rejected** (CRITICAL)
   - Image shapes with empty href rejected
   - Image shapes with non-positive dimensions rejected
   - Embedded fragments validated recursively via validateEmbed

3. **Embed Validation**
   - Valid namespace passes (letters and numbers only, starts with letter)
   - Invalid namespace characters rejected (underscores not allowed)
   - Duplicate namespace in same scope rejected
   - **Non-ancestor rootMaterialId rejected** (CRITICAL)

4. **Resolution**
   - Embed nodes resolved to FrameNodes
   - Material IDs correctly namespaced
   - RootMaterialRef refs updated to rootMaterialId
   - **RootMaterialRef removed, children lifted**
   - Nested embeds resolved with compound namespaces
   - Shapes pass through unchanged
   - Transforms pass through unchanged

5. **Fragment to Frame Conversion**
   - RootMaterialRef becomes RootMaterial with provided styles
   - Viewport applied correctly
   - Children preserved

### Integration Tests

1. **Procedural + Fragment**
   - Embed fragment generator into procedural sketch
   - Create and embed inline fragments
   - Style inheritance works correctly
   - Same fragment embedded twice with different namespaces

2. **Object + Fragment**
   - FragmentScene produces valid fragments
   - Scene.embed() works correctly
   - Group.embedFragment() works correctly

3. **Cross-Generator**
   - Procedural embeds object fragment
   - Object embeds procedural fragment
   - Three-level nesting works

### Visual Tests (test-app)

1. **Fragment Gallery**
   - Display same fragment with different styles
   - Display fragment at different transforms
   - Compare embedded vs. inline rendering

2. **Composition Demo**
   - Complex scene built from multiple fragments
   - Verify visual parity across renderers
