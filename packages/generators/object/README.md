# @medli/generator-object

Object-oriented generator for medli, inspired by three.js.

## Design

This generator uses a **scene graph pattern** where:

1. **Scene** is the root container that implements `Generator`
2. **Materials** define style properties (fill, stroke, strokeWidth)
3. **Shapes** (Circle, Line) reference materials via `.material` property
4. **Scene.frame()** groups shapes by material to build the IR tree

### Why this pattern?

Like three.js, the object-oriented approach lets you:

- Create a Scene and pass it directly to renderers
- Add/remove objects dynamically
- Modify object properties (`circle.x = 100`, `material.fill = "red"`)
- Build complex scenes by composing objects
- Share materials between multiple shapes

### Three.js-style API

Materials and shapes are independent objects. Shapes reference materials:

```typescript
const scene = new Scene();

// Create materials (added to scene independently)
const redMaterial = new Material({ fill: "#ff0000" });
scene.add(redMaterial);

// Create shapes and assign materials
const circle = new Circle(50, 50, 10);
circle.material = redMaterial;
scene.add(circle);

// Multiple shapes can share the same material
const anotherCircle = new Circle(100, 50, 15);
anotherCircle.material = redMaterial;
scene.add(anotherCircle);
```

### Current implementation

```
Scene (implements Generator)
├── background?: Background
├── children: SceneObject[]
│   ├── Material { id, fill?, stroke?, strokeWidth?, parent? }
│   ├── Circle { x, y, radius, material? }
│   └── Line { x1, y1, x2, y2, material? }
```

The `frame()` method on Scene:
1. Collects all materials (explicit + referenced by shapes)
2. Groups shapes by their material reference
3. Builds IR tree with materials containing their shapes
4. Preserves insertion order for interleaved shapes/materials

## Material-Based Frame Output

The object generator emits a **Material-based tree** (see `@medli/spec` README).

### Materials and shapes in the scene

Materials provide style context; shapes reference them:

```typescript
const scene = new Scene();
const bg = new Background("#ffffff");
scene.setBackground(bg);

// Create materials
const primaryStyle = new Material({ fill: "#0066cc" });
const dangerStyle = new Material({ fill: "#cc0000" });

// Create shapes referencing materials
const circle1 = new Circle(25, 25, 10);
circle1.material = primaryStyle;
const circle2 = new Circle(75, 25, 10);
circle2.material = primaryStyle;
const circle3 = new Circle(50, 75, 15);
circle3.material = dangerStyle;

// Add all to scene
scene.add(primaryStyle);
scene.add(circle1);
scene.add(circle2);
scene.add(dangerStyle);
scene.add(circle3);
```

Emits:
```
RootMaterial (complete defaults from Scene)
├── ChildMaterial (fill: "#0066cc")
│   ├── Circle
│   └── Circle
└── ChildMaterial (fill: "#cc0000")
    └── Circle
```

### Nested materials for style inheritance

Materials can have a parent for style inheritance:

```typescript
const outer = new Material({ fill: "red", stroke: "black" });
const inner = new Material({ fill: "blue" }); // will inherit stroke from outer
inner.parent = outer;

const circle = new Circle(50, 50, 10);
circle.material = inner;

scene.add(outer);
scene.add(inner);
scene.add(circle);
```

### Generator responsibilities

The Scene (as Generator) must:
1. Create RootMaterial with complete defaults
2. Group shapes by their material reference
3. Use Material's unique IDs
4. Ensure all ChildMaterials reference their parent Material

## Usage

```typescript
import { Scene, Background, Circle, Line, Material } from "@medli/generator-object";
import { SvgRenderer } from "@medli/renderer-svg";

// Create scene (implements Generator)
const scene = new Scene();

// Add a background (optional)
const bg = new Background("#f0f0f0");
scene.setBackground(bg);

// Create materials
const redMaterial = new Material({ fill: "#ff0000" });
const blueMaterial = new Material({ fill: "#0000ff", stroke: "#000000", strokeWidth: 2 });

// Create shapes and assign materials
const circle1 = new Circle(50, 50, 20);
circle1.material = redMaterial;

const circle2 = new Circle(100, 50, 15);
circle2.material = blueMaterial;

const line = new Line(0, 0, 150, 100);
line.material = blueMaterial;

// Add everything to scene
scene.add(redMaterial);
scene.add(blueMaterial);
scene.add(circle1);
scene.add(circle2);
scene.add(line);

// Pass scene directly to renderer
const renderer = new SvgRenderer(element, scene);
renderer.loop();

// Modify at runtime - changes appear next frame
redMaterial.fill = "#00ff00";
circle1.x = 75;
```

### Without materials (uses Scene defaults)

```typescript
const scene = new Scene();
scene.fill = "#333333";  // Default fill for shapes without material
scene.stroke = "#ffffff";
scene.strokeWidth = 2;

// Shape without material uses scene defaults
const circle = new Circle(50, 50, 10);
scene.add(circle);
```

## API

### `Scene`

Root container implementing `Generator`. Pass directly to renderers.

- `background: Background | null` - Current background (readonly getter)
- `setBackground(bg: Background | null): this` - Set/clear background
- `add(child: SceneObject): this` - Add a scene object (shape or material)
- `remove(child: SceneObject): this` - Remove a scene object
- `frame(time: number): Frame` - Generate frame from scene tree
- `fill: string` - Default fill color (default: "#000000")
- `stroke: string` - Default stroke color (default: "#000000")
- `strokeWidth: number` - Default stroke width (default: 1)

### `Background`

Represents the scene background color.

- `color: string` - The background color (CSS color string)

### `Material`

Provides style properties for shapes.

- `id: string` - Unique identifier (readonly, auto-generated)
- `fill?: string` - Fill color
- `stroke?: string` - Stroke color
- `strokeWidth?: number` - Stroke width
- `parent?: Material` - Parent material for style inheritance

### `Circle`

A circle shape.

- `x: number` - Center X coordinate
- `y: number` - Center Y coordinate
- `radius: number` - Circle radius
- `material?: Material` - Material reference for styling

### `Line`

A line from start to end.

- `x1: number` - Start X coordinate
- `y1: number` - Start Y coordinate
- `x2: number` - End X coordinate
- `y2: number` - End Y coordinate
- `material?: Material` - Material reference for styling
- `static fromOffset(x, y, dx, dy): Line` - Create line from start point and offset

### `Shape`

Interface for shapes that can reference a Material.

```typescript
interface Shape extends SceneObject {
  material?: Material;
}
```

### `SceneObject`

Interface for objects that can be added to a scene.

```typescript
interface SceneObject {
  frame(time: number): FrameNode[];
}
```
