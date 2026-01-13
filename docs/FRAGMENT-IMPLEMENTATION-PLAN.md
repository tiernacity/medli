# Fragment Implementation Plan

## Overview

Fragment enables generator composition by allowing reusable scene graph pieces to be embedded into Frames or other Fragments. A Fragment is nearly identical to Frame but has a `RootMaterialRef` (no styles, references external material) instead of a `RootMaterial`, and has no viewport.

This feature enables:
- Composing scenes from multiple generators
- Style inheritance from embedding context
- Cross-generator composition (procedural embedding object fragments and vice versa)
- Reusable visual components as independent generators

## Design Document Reference

See `docs/FRAGMENT-DESIGN.md` for full design details including:
- Core insight (Fragment approximately equals Frame)
- Resolution semantics
- Namespace evaluation
- Material inheritance model
- Edge cases and test plan

## Implementation Phases

### Phase 1: Core Types (packages/spec)

**Files to modify:**
- `packages/spec/src/index.ts`

**Types to add:**

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
   */
  namespace: string;
  /**
   * Material ID that the fragment's RootMaterialRef resolves to.
   * Must be an ancestor material in the tree where this Embed appears.
   */
  rootMaterialId: string;
  /**
   * The fragment to embed.
   */
  fragment: Fragment;
};

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
 * Extended FrameNode that includes Embed (used only during generation, before resolution).
 */
export type UnresolvedFrameNode = FrameNode | Embed;
```

**Exports to add:**
```typescript
export type {
  RootMaterialRef,
  Fragment,
  Embed,
  FragmentGenerator,
  UnresolvedFrameNode,
};
```

**Tests to write (in `packages/spec/src/__tests__/fragment.test.ts`):**
- Type assignability tests for RootMaterialRef
- Type assignability tests for Fragment
- Type assignability tests for Embed
- FragmentGenerator interface implementation test

**Acceptance criteria:**
- [ ] `npm run typecheck` passes
- [ ] All new types exported from `@medli/spec`
- [ ] Type tests pass

---

### Phase 2: Validation (packages/spec)

**Files to modify:**
- `packages/spec/src/index.ts`

**Functions to add:**

```typescript
/**
 * Validate a fragment's structure.
 * Checks: RootMaterialRef has non-empty ID, unique material IDs,
 * valid ancestor refs, valid transform matrices, valid embedded fragments.
 */
export function validateFragment(fragment: Fragment): ValidationResult {
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

  function checkNode(node: FrameNode | Embed, ancestorIds: Set<string>): ValidationResult {
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
      // Validate matrix
      if (node.matrix.length !== 6) {
        return {
          valid: false,
          error: `Transform matrix must have exactly 6 values, got ${node.matrix.length}`,
        };
      }
      for (let i = 0; i < 6; i++) {
        if (typeof node.matrix[i] !== "number" || !isFinite(node.matrix[i])) {
          return { valid: false, error: `Transform matrix[${i}] must be a finite number` };
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
      // Validate image
      if (!node.url || node.url.length === 0) {
        return { valid: false, error: "Image url must be a non-empty string" };
      }
      if (typeof node.width !== "number" || node.width <= 0 || !isFinite(node.width)) {
        return { valid: false, error: "Image width must be a positive finite number" };
      }
      if (typeof node.height !== "number" || node.height <= 0 || !isFinite(node.height)) {
        return { valid: false, error: "Image height must be a positive finite number" };
      }
      // Validate crop if present (same as validateFrame)
      if (node.crop !== undefined) {
        // ... crop validation (same as existing validateFrame)
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
      error: "Embed namespace must start with a letter and contain only letters/numbers (no underscores)",
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
```

**Exports to add:**
```typescript
export { validateFragment, validateEmbed };
```

**Tests to write (in `packages/spec/src/__tests__/fragment.test.ts`):**

**validateFragment tests:**
- RootMaterialRef with non-empty ID is valid
- RootMaterialRef with empty ID is rejected
- Empty fragment (no children) is valid
- Duplicate material IDs rejected
- Non-ancestor refs rejected (CRITICAL)
- Invalid transform matrices rejected
- Image validation (same rules as Frame)
- Fragment with nested embeds validated recursively

**validateEmbed tests:**
- Valid namespace passes (letters and numbers only, starts with letter)
- Namespace with underscore rejected
- Namespace starting with number rejected
- Duplicate namespace in same scope rejected
- Non-ancestor rootMaterialId rejected (CRITICAL)
- Fragment validation propagates errors

**Acceptance criteria:**
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes with new tests
- [ ] validateFragment catches all invalid cases
- [ ] validateEmbed catches all invalid cases

---

### Phase 3: Resolution (packages/spec)

**Files to modify:**
- `packages/spec/src/index.ts`

**Functions to add:**

```typescript
/**
 * Resolve a single Embed node into FrameNodes.
 * Namespaces material IDs and rewrites refs.
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

  function processNode(node: FrameNode | Embed): FrameNode[] {
    if (node.type === "material") {
      // Namespace the ID
      const namespacedId = `${namespace}_${node.id}`;
      createdMaterialIds.add(namespacedId);

      // Rewrite ref
      let resolvedRef: string;
      if ("ref" in node) {
        resolvedRef = node.ref === rootRefId
          ? rootMaterialId
          : `${namespace}_${node.ref}`;
      }

      // Create resolved material
      const result: ChildMaterial = {
        type: "material",
        id: namespacedId,
        ref: resolvedRef!,
        children: node.children.flatMap(c => processNode(c as FrameNode | Embed)),
      };

      // Copy style overrides
      if (node.fill !== undefined) result.fill = node.fill;
      if (node.stroke !== undefined) result.stroke = node.stroke;
      if (node.strokeWidth !== undefined) result.strokeWidth = node.strokeWidth;

      return [result];
    } else if (node.type === "transform") {
      return [{
        type: "transform",
        matrix: node.matrix,
        children: node.children.flatMap(c => processNode(c as FrameNode | Embed)),
      }];
    } else if (node.type === "embed") {
      // Recursive resolution - namespace compounds
      const nestedNamespace = `${namespace}_${node.namespace}`;
      const nestedRootId = node.rootMaterialId === rootRefId
        ? rootMaterialId
        : `${namespace}_${node.rootMaterialId}`;

      // Build ancestor set for nested embed
      const nestedAncestors = new Set(ancestorMaterialIds);
      for (const id of createdMaterialIds) {
        nestedAncestors.add(id);
      }

      return resolveEmbed(
        { ...node, namespace: nestedNamespace, rootMaterialId: nestedRootId },
        nestedAncestors
      );
    } else {
      // Shape - pass through unchanged
      return [node];
    }
  }

  // Process RootMaterialRef's children (not the RootMaterialRef itself)
  return fragment.root.children.flatMap(c => processNode(c as FrameNode | Embed));
}

/**
 * Resolve all Embed nodes in a Frame, producing a Frame with only FrameNodes.
 */
export function resolveFrame(frame: Frame): Frame {
  function resolveNode(node: FrameNode | Embed, ancestorIds: Set<string>): FrameNode[] {
    if (node.type === "embed") {
      return resolveEmbed(node, ancestorIds);
    } else if (node.type === "material") {
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);

      const result: Material = "ref" in node
        ? {
            type: "material",
            id: node.id,
            ref: node.ref,
            children: node.children.flatMap(c => resolveNode(c as FrameNode | Embed, newAncestors)),
          }
        : {
            type: "material",
            id: node.id,
            fill: node.fill,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            children: node.children.flatMap(c => resolveNode(c as FrameNode | Embed, newAncestors)),
          };

      // Copy style overrides for ChildMaterial
      if ("ref" in node) {
        if (node.fill !== undefined) (result as ChildMaterial).fill = node.fill;
        if (node.stroke !== undefined) (result as ChildMaterial).stroke = node.stroke;
        if (node.strokeWidth !== undefined) (result as ChildMaterial).strokeWidth = node.strokeWidth;
      }

      return [result];
    } else if (node.type === "transform") {
      return [{
        type: "transform",
        matrix: node.matrix,
        children: node.children.flatMap(c => resolveNode(c as FrameNode | Embed, ancestorIds)),
      }];
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
    children: frame.root.children.flatMap(c =>
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
 */
export function fragmentToFrame(
  fragment: Fragment,
  viewport: Viewport,
  defaultMaterial: { fill: string; stroke: string; strokeWidth: number },
  rootId: string = "root"
): Frame {
  const fragRootId = fragment.root.id;

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

**Exports to add:**
```typescript
export { resolveEmbed, resolveFrame, fragmentToFrame };
```

**Tests to write (in `packages/spec/src/__tests__/fragment.test.ts`):**

**resolveEmbed tests:**
- Embed nodes resolved to FrameNodes
- Material IDs correctly namespaced (`namespace_originalId`)
- RootMaterialRef refs rewritten to rootMaterialId
- Internal fragment refs namespaced correctly
- RootMaterialRef removed, children lifted
- Nested embeds resolved with compound namespaces (`outer_inner_id`)
- Shapes pass through unchanged
- Transforms pass through unchanged
- Throws on non-ancestor rootMaterialId

**resolveFrame tests:**
- Frame with no embeds unchanged
- Frame with single embed resolved correctly
- Frame with multiple embeds at same level resolved
- Frame with nested materials containing embeds resolved
- Resolved frame passes validateFrame

**fragmentToFrame tests:**
- RootMaterialRef becomes RootMaterial with provided styles
- Viewport applied correctly
- Children preserved
- Refs to RootMaterialRef.id rewritten to new rootId
- Other refs unchanged

**Acceptance criteria:**
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes with new tests
- [ ] Resolution produces valid Frames (verify with validateFrame)

---

### Phase 4: Procedural Generator (packages/generators/procedural)

**Files to modify:**
- `packages/generators/procedural/src/index.ts`

**Changes to Sketch interface:**

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

**Implementation notes:**
- Track `currentParentId` (already exists) for `Embed.rootMaterialId`
- Store Embed nodes in the tree during drawing
- Call `resolveFrame()` at the end of `frame()` method
- `createFragment()` runs a draw function in a separate context and returns Fragment
- Need to import `Fragment`, `FragmentGenerator`, `Embed`, `RootMaterialRef`, `resolveFrame` from `@medli/spec`

**Changes to ProceduralGenerator class:**

```typescript
// In frame() method:
// 1. Add embed() to sketch object
// 2. Add createFragment() to sketch object
// 3. Call resolveFrame() before returning

embed(fragmentGen: FragmentGenerator | Fragment, namespace: string) {
  const frag = 'fragment' in fragmentGen
    ? fragmentGen.fragment({ time, targetDimensions: [targetWidth, targetHeight] })
    : fragmentGen;

  const embedNode: Embed = {
    type: "embed",
    namespace,
    rootMaterialId: currentParentId,
    fragment: frag,
  };
  insertionPoint.push(embedNode as unknown as FrameNode);
},

createFragment(draw: (p: Sketch) => void): Fragment {
  // Create isolated context for fragment
  const fragmentChildren: (FrameNode | Embed)[] = [];
  let fragmentInsertionPoint = fragmentChildren;
  let fragmentParentId = "fragment_root";
  const fragmentContextStack: SavedContext[] = [];
  let fragmentMaterialIdCounter = 0;
  const nextFragmentMaterialId = () => `fm${++fragmentMaterialIdCounter}`;

  // Create fragment sketch context (similar to main sketch but isolated)
  const fragmentSketch: Sketch = {
    // ... implement all sketch methods using fragment-local state ...
    // viewport() should throw - fragments don't have viewports
    // background() should throw - fragments don't have backgrounds
  };

  draw(fragmentSketch);

  const root: RootMaterialRef = {
    type: "root-material-ref",
    id: "fragment_root",
    children: fragmentChildren as FrameNode[],
  };

  return { root };
}
```

**Tests to write (in `packages/generators/procedural/src/__tests__/fragment.test.ts`):**
- `embed()` adds Embed node to tree
- `embed()` uses current material as rootMaterialId
- `embed()` with FragmentGenerator calls fragment()
- `embed()` with Fragment uses directly
- `createFragment()` captures drawing operations
- `createFragment()` throws on viewport()
- `createFragment()` throws on background()
- `createFragment()` returns valid Fragment
- Full integration: embed fragment, verify resolved output
- Same fragment embedded twice with different namespaces

**Acceptance criteria:**
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Procedural generator can embed fragments
- [ ] Procedural generator can create fragments

---

### Phase 5: Object Generator (packages/generators/object)

**Files to modify:**
- `packages/generators/object/src/index.ts`

**New class to add:**

```typescript
/**
 * A scene that produces Fragments instead of Frames.
 * Use this when creating reusable visual components.
 */
export class FragmentScene implements FragmentGenerator {
  private children: SceneObject[] = [];

  add(child: SceneObject): this {
    this.children.push(child);
    return this;
  }

  remove(child: SceneObject): this {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    return this;
  }

  fragment(context: RenderContext): Fragment {
    const { time } = context;

    // Similar logic to Scene.frame() but:
    // 1. No viewport
    // 2. RootMaterialRef instead of RootMaterial
    // 3. No background handling

    // ... collect children nodes ...

    const root: RootMaterialRef = {
      type: "root-material-ref",
      id: "scene_root",
      children: childNodes,
    };

    return { root };
  }
}
```

**Changes to Group class:**

```typescript
export class Group extends SceneObject {
  // ... existing code ...

  /**
   * Embed a fragment into this group.
   * The fragment inherits styles from the specified material (or root if not specified).
   */
  embedFragment(
    fragmentGen: FragmentGenerator | Fragment,
    namespace: string,
    rootMaterialId: string = "root"
  ): this {
    // Store embed info for processing during frame()
    this.embeds.push({ fragmentGen, namespace, rootMaterialId });
    return this;
  }

  // Add private embeds storage and process in frame()
}
```

**Changes to Scene class:**

```typescript
export class Scene implements Generator {
  // ... existing code ...

  /**
   * Embed a fragment into this scene at root level.
   * The fragment inherits styles from the specified material (or root if not specified).
   */
  embed(
    fragmentGen: FragmentGenerator | Fragment,
    namespace: string,
    rootMaterialId: string = "root"
  ): this {
    this.embeds.push({ fragmentGen, namespace, rootMaterialId });
    return this;
  }

  frame(context: RenderContext): Frame {
    // ... existing code ...
    // After building tree, call resolveFrame()
    return resolveFrame(unresolvedFrame);
  }
}
```

**Tests to write (in `packages/generators/object/src/__tests__/fragment.test.ts`):**
- FragmentScene produces valid fragments
- FragmentScene.add() works like Scene.add()
- Scene.embed() adds Embed node
- Scene.embed() with FragmentGenerator calls fragment()
- Scene.embed() with Fragment uses directly
- Group.embedFragment() adds nested Embed
- Full integration: embed FragmentScene into Scene
- Same FragmentScene embedded twice with different namespaces
- Material inheritance from embedding context

**Acceptance criteria:**
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Object generator can embed fragments
- [ ] FragmentScene produces valid fragments

---

### Phase 6: Integration & Visual Tests (packages/test-app)

**Files to modify/create:**
- `packages/test-app/src/scenes/fragment-demo.ts` (new)
- `packages/test-app/src/scenes/index.ts` (add export)
- `packages/test-app/src/App.tsx` (add to scene list)

**Demo scenes to create:**

1. **Basic Fragment Embedding**
   - Create a star fragment using procedural
   - Embed it multiple times with different colors

2. **Cross-Generator Composition**
   - Create fragment with object generator
   - Embed into procedural generator scene
   - And vice versa

3. **Nested Fragments**
   - Fragment containing fragment
   - Verify namespace compounding

4. **Style Inheritance Demo**
   - Same fragment with different embedding contexts
   - Show fill/stroke inheritance

**Visual parity tests:**
- Same fragment rendered via both generator types produces identical output
- Resolved frame renders identically to manually-constructed equivalent

**Acceptance criteria:**
- [ ] Demo scenes render correctly
- [ ] All renderers produce equivalent output
- [ ] Cross-generator composition works

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/spec/src/index.ts` | Modify | Add all new types, validation, and resolution functions |
| `packages/spec/src/__tests__/fragment.test.ts` | Create | All spec-level tests |
| `packages/generators/procedural/src/index.ts` | Modify | Add embed(), createFragment() to Sketch |
| `packages/generators/procedural/src/__tests__/fragment.test.ts` | Create | Procedural fragment tests |
| `packages/generators/object/src/index.ts` | Modify | Add FragmentScene, Scene.embed(), Group.embedFragment() |
| `packages/generators/object/src/__tests__/fragment.test.ts` | Create | Object fragment tests |
| `packages/test-app/src/scenes/fragment-demo.ts` | Create | Visual demo scenes |
| `packages/test-app/src/scenes/index.ts` | Modify | Export fragment demos |

---

## Dependencies Between Phases

```
Phase 1 (Core Types)
    |
    v
Phase 2 (Validation) ----+
    |                    |
    v                    |
Phase 3 (Resolution) <---+
    |
    +-------------------+
    |                   |
    v                   v
Phase 4 (Procedural)  Phase 5 (Object)  <-- Can run in PARALLEL
    |                   |
    +-------------------+
    |
    v
Phase 6 (Integration Tests)
```

**Sequential:**
- Phase 1 must complete before Phase 2
- Phase 2 must complete before Phase 3
- Phase 3 must complete before Phases 4 and 5
- Phases 4 and 5 must complete before Phase 6

**Parallel:**
- Phases 4 and 5 can run in parallel after Phase 3

---

## Acceptance Criteria

### Per-Phase Verification

After each phase:
```bash
npm run typecheck  # TypeScript compilation
npm run lint       # ESLint passes
npm run test       # All tests pass
```

### Final Verification

After all phases:
```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run dev  # Visual verification in test-app
```

### Feature Complete Checklist

- [ ] RootMaterialRef type defined and exported
- [ ] Fragment type defined and exported
- [ ] Embed type defined and exported
- [ ] FragmentGenerator interface defined and exported
- [ ] validateFragment() implemented and exported
- [ ] validateEmbed() implemented and exported
- [ ] resolveEmbed() implemented and exported
- [ ] resolveFrame() implemented and exported
- [ ] fragmentToFrame() implemented and exported
- [ ] ProceduralGenerator.embed() implemented
- [ ] ProceduralGenerator.createFragment() implemented
- [ ] FragmentScene class implemented
- [ ] Scene.embed() implemented
- [ ] Group.embedFragment() implemented
- [ ] All unit tests pass
- [ ] Visual demo scenes work
- [ ] Cross-generator composition verified

---

## Commands to Run

```bash
# Install dependencies (if needed)
npm install

# Type checking
npm run typecheck

# Run tests
npm run test

# Run specific test file
npx jest packages/spec/src/__tests__/fragment.test.ts

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format:check
npm run format

# Visual verification
npm run dev
```

---

## Notes for Implementation Session

### Sub-Agent Requirements (per CLAUDE.md)

**CRITICAL:** All file edits MUST be performed via Task agents. Use `.claude/agents.toml` to identify the correct agent for each package.

**Agent assignments:**
- Phase 1-3 (spec): `agents.spec`
- Phase 4 (procedural): `agents.generator-procedural`
- Phase 5 (object): `agents.generator-object`
- Phase 6 (test-app): `agents.test-app`

**Parallel execution:** After Phase 3, spawn Phase 4 and Phase 5 agents in parallel.

### Design Notes

1. **Embed nodes are transient** - They exist only during generation and are resolved before the Frame reaches renderers.

2. **Namespace underscore separator** - The `_` character joins namespace segments. Namespaces cannot contain underscores to prevent ambiguity.

3. **RootMaterialRef is removed during resolution** - Its children are lifted into the parent tree.

4. **Material refs rewrite rules:**
   - `ref === fragment.root.id` -> `rootMaterialId`
   - Otherwise -> `namespace_originalRef`

5. **Fragments are immutable** - Multiple Embed nodes can safely reference the same Fragment object.

### Testing Strategy

1. **Unit tests first** - Validate types and functions in isolation
2. **Integration tests** - Verify end-to-end generation and resolution
3. **Visual tests** - Confirm rendering matches expectations

### Potential Gotchas

1. **Type narrowing** - When processing nodes, handle the Embed type carefully (it's not in FrameNode union)
2. **Circular references** - Fragments should not reference themselves (validated by ancestor-only rule)
3. **Empty namespaces** - Reject at validation time
4. **rootMaterialId validation** - Must check against ancestors at each level, not just root

### Reference Implementation

See `docs/FRAGMENT-DESIGN.md` for the complete resolveEmbed algorithm and validation pseudocode.
