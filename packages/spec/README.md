# @medli/spec

Core types and interfaces for medli - the contract between generators and renderers.

## Design Philosophy

The Frame spec is an **intermediate representation (IR)**. It:

- Optimizes for **validation simplicity**, not human readability
- Uses **simple rules** for parsing and validation
- Does **not** need to be easy to read or write for humans

Generators provide ergonomic APIs. Renderers consume the IR and transform as needed.

## Core Concept: Material-Based Tree

The Frame is a **tree structure** where:

1. **Root is a complete Material** - all style properties defined
2. **Materials are nodes** with children and style properties
3. **Shapes are leaves** - pure geometry, no style properties
4. **Style inheritance** flows down the tree via Material references

### Why Materials?

Materials solve several problems:

- **Shared styles**: Many shapes can inherit from one Material
- **Composition**: Partial overrides at any level
- **Validation**: Single-pass, top-to-bottom, no cycles possible
- **Future transforms**: Material nodes provide grouping for transforms

## Type Structure

```typescript
// Complete material - all properties required (root only)
type RootMaterial = {
  type: "material";
  id: string;
  fill: string;         // required
  stroke: string;       // required
  strokeWidth: number;  // required
  children: FrameNode[];
};

// Partial material - properties optional, ref required
type ChildMaterial = {
  type: "material";
  id: string;           // required, must be unique
  ref: string;          // required, must reference an ancestor
  fill?: string;        // optional override
  stroke?: string;      // optional override
  strokeWidth?: number; // optional override
  children: FrameNode[];
};

type Material = RootMaterial | ChildMaterial;

// Shapes - pure geometry, no style properties
type Circle = {
  type: "circle";
  center: Position;
  radius: number;
};

type Line = {
  type: "line";
  start: Position;
  end: Position;
};

type Shape = Circle | Line;

// Tree structure
type FrameNode = Material | Shape;

type Frame = {
  backgroundColor?: string;
  root: RootMaterial;
};
```

## Validation Rules

Validation is **single-pass, top-to-bottom**:

1. **Root must be complete**: All style properties (fill, stroke, strokeWidth) defined
2. **IDs must be unique**: No duplicate Material IDs in the tree
3. **Refs must be ancestors**: Each ChildMaterial's `ref` must point to an ancestor Material's `id`
4. **Shapes are leaves**: Shapes cannot have children (enforced by types)

### Validation Algorithm

```typescript
function validateFrame(frame: Frame): ValidationResult {
  const seenIds = new Set<string>();

  function validate(node: FrameNode, ancestorIds: Set<string>): void {
    if (node.type === "material") {
      // Check ID uniqueness
      if (seenIds.has(node.id)) {
        throw new Error(`Duplicate material ID: ${node.id}`);
      }
      seenIds.add(node.id);

      // Check ref is ancestor (for non-root)
      if ("ref" in node) {
        if (!ancestorIds.has(node.ref)) {
          throw new Error(`Material ${node.id} refs non-ancestor: ${node.ref}`);
        }
      }

      // Recurse with updated ancestors
      const newAncestors = new Set(ancestorIds);
      newAncestors.add(node.id);
      for (const child of node.children) {
        validate(child, newAncestors);
      }
    }
    // Shapes are leaves - no recursion needed
  }

  // Start from root
  validate(frame.root, new Set());
}
```

## Style Resolution

To render a shape, resolve its effective material by walking up the tree:

```typescript
function resolveMaterial(shape: Shape, ancestors: Material[]): ResolvedMaterial {
  // Start with root material (always complete)
  let resolved = { ...ancestors[0] };

  // Apply overrides from each ancestor (root to immediate parent)
  for (const material of ancestors.slice(1)) {
    if (material.fill !== undefined) resolved.fill = material.fill;
    if (material.stroke !== undefined) resolved.stroke = material.stroke;
    if (material.strokeWidth !== undefined) resolved.strokeWidth = material.strokeWidth;
  }

  return resolved;
}
```

## Example Frame

```typescript
const frame: Frame = {
  backgroundColor: "#ffffff",
  root: {
    type: "material",
    id: "root",
    fill: "#000000",
    stroke: "#000000",
    strokeWidth: 1,
    children: [
      {
        type: "material",
        id: "primary",
        ref: "root",
        fill: "#0066cc",
        children: [
          { type: "circle", center: { x: 25, y: 25 }, radius: 10 },
          { type: "circle", center: { x: 75, y: 25 }, radius: 10 },
        ]
      },
      {
        type: "material",
        id: "danger",
        ref: "root",
        fill: "#cc0000",
        children: [
          { type: "circle", center: { x: 50, y: 75 }, radius: 15 }
        ]
      }
    ]
  }
};
```

In this frame:
- Root defines complete defaults (black fill/stroke, 1px width)
- "primary" overrides fill to blue, inherits stroke from root
- "danger" overrides fill to red, inherits stroke from root
- Circles have no style properties - they inherit from their parent Material

## Validation Placement

- **Generators** should NOT validate their own output (separation of concerns)
- **Renderers** call `validateFrame()` before rendering (for now)
- **Future**: Validation could be middleware between generator and renderer

## Design Decisions

### Why ancestor-only references?

- **No cycles**: References only go "up", so cycles are impossible by construction
- **Single-pass validation**: Check ref exists in ancestors as you traverse down
- **Shared materials hoisted**: Common materials must be ancestors of all users

### Why shapes have no style?

- **Clean separation**: Geometry vs. style are separate concerns
- **Single override point**: Wrap shape in Material to customize
- **Simpler types**: Shapes are pure data

### Why heterogeneous types (not generic nodes)?

- **Type safety**: Shapes can't have children (compile-time error)
- **Self-documenting**: Types show what can contain what
- **Sufficient for now**: Revisit when transforms add more container types

## Future Extensions

### Transforms (planned)

```typescript
type Transform = {
  type: "transform";
  translate?: Position;
  rotate?: number;
  scale?: number;
  children: FrameNode[];
};

type FrameNode = Material | Transform | Shape;
```

### Additional Material Properties

```typescript
type Material = {
  // ... existing
  opacity?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  dashArray?: number[];
};
```

### Frame Optimization

A future `optimizeFrame()` utility could:
- Deduplicate identical Materials
- Flatten unnecessary nesting
- Compact verbose generator output

## Migration from v1

The previous flat Frame structure:

```typescript
// OLD
type Frame = {
  backgroundColor?: string;
  shapes?: Shape[];
};

// OLD - shapes had no style
type Circle = { type: "circle"; center: Position; radius: number };
```

New Material-based structure requires:
- Generators emit tree with root Material
- Renderers traverse tree and resolve styles
- All style lives in Materials, not Shapes
