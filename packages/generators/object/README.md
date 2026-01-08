# @medli/generator-object

Object-oriented generator for medli, inspired by three.js.

## Design

This generator uses a **scene graph pattern** where:

1. **Scene** is the root container that implements `Generator`
2. **SceneObjects** (like Background) can be added as children
3. Each object implements `frame()` returning partial frame data
4. Scene traverses children and merges their contributions

### Why this pattern?

Like three.js, the object-oriented approach lets you:

- Create a Scene and pass it directly to renderers
- Add/remove objects dynamically
- Modify object properties (`background.color = "red"`)
- Build complex scenes by composing objects

### Current implementation

```
Scene (implements Generator)
└── background?: Background
└── children: SceneObject[]
```

The `frame()` method on Scene:
1. Starts with an empty frame
2. Applies background (if set)
3. Applies each child in order
4. Returns merged frame

### Future extensions

```typescript
Scene
├── background?: Background
├── children: SceneObject[]
│   ├── Material { fill?, stroke?, strokeWidth? }
│   │   └── children: SceneObject[]
│   ├── Rectangle { x, y, width, height }
│   ├── Circle { cx, cy, r }
│   └── Transform { translate?, rotate?, scale? }
│       └── children: SceneObject[]
```

## Material-Based Frame Output

The object generator emits a **Material-based tree** (see `@medli/spec` README).

### Material objects in the scene

Materials are scene objects that provide style context for their children:

```typescript
const scene = new Scene();
const bg = new Background("#ffffff");
scene.setBackground(bg);

// Create a material with style properties
const primaryStyle = new Material({ fill: "#0066cc" });
primaryStyle.add(new Circle(25, 25, 10));
primaryStyle.add(new Circle(75, 25, 10));
scene.add(primaryStyle);

// Another material with different style
const dangerStyle = new Material({ fill: "#cc0000" });
dangerStyle.add(new Circle(50, 75, 15));
scene.add(dangerStyle);
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

### Nested materials for overrides

Materials can be nested for partial overrides:

```typescript
const outer = new Material({ fill: "red", stroke: "black" });
const inner = new Material({ fill: "blue" }); // inherits stroke from outer
inner.add(new Circle(50, 50, 10));
outer.add(inner);
scene.add(outer);
```

### Generator responsibilities

The Scene (as Generator) must:
1. Create RootMaterial with complete defaults
2. Traverse scene graph, converting Material objects to ChildMaterial nodes
3. Generate unique Material IDs
4. Ensure all ChildMaterials reference their parent Material

## Usage

```typescript
import { Scene, Background } from "@medli/generator-object";
import { SvgRenderer } from "@medli/renderer-svg";

// Create scene (implements Generator)
const scene = new Scene();

// Add a background (optional)
const bg = new Background("#ff0000");
scene.setBackground(bg);
// or: scene.add(bg);

// Pass scene directly to renderer
const renderer = new SvgRenderer(element, scene);
renderer.loop();

// Change background color
bg.color = "#00ff00";

// Remove background (renderer will use default white)
scene.setBackground(null);
```

### Without background

```typescript
const scene = new Scene();
// No background set - renderer uses white default
const renderer = new SvgRenderer(element, scene);
```

## API

### `Scene`

Root container implementing `Generator`. Pass directly to renderers.

- `background: Background | null` - Current background (readonly getter)
- `setBackground(bg: Background | null): this` - Set/clear background
- `add(child: SceneObject): this` - Add a scene object
- `remove(child: SceneObject): this` - Remove a scene object
- `frame(time: number): Frame` - Generate frame from scene tree

### `Background`

Represents the scene background color.

- `color: string` - The background color (CSS color string)
- `frame(time: number): Partial<Frame>` - Returns `{ backgroundColor }`

### `SceneObject`

Interface for objects that can be added to a scene.

```typescript
interface SceneObject {
  frame(time: number): Partial<Frame>;
}
```
