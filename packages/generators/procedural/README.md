# @medli/generator-procedural

Procedural generator for medli, inspired by p5.js.

## Design

This generator uses a **sketch pattern** where:

1. You pass a **draw function** to the generator
2. The draw function is called **every frame**
3. Inside draw, you call **procedural functions** like `background()`
4. The generator collects these calls and builds the frame

### Why this pattern?

Like p5.js, the procedural approach lets you:

- Write code that reads top-to-bottom ("set background, then draw shapes")
- Focus on *what* to draw, not on managing state
- Easily animate by using the `time` parameter
- Think imperatively rather than declaratively

### Comparison with p5.js

```javascript
// p5.js
function draw() {
  background(220);
  ellipse(50, 50, 80, 80);
}

// medli procedural
const gen = new ProceduralGenerator((p) => {
  p.background("#dcdcdc");
  // p.ellipse(50, 50, 80, 80);  // future
});
```

The key difference is that medli passes the sketch context `p` as a parameter,
while p5.js uses global functions. This makes medli more explicit and allows
multiple generators to coexist.

### Current implementation

```typescript
interface Sketch {
  background(color: string): void;
  readonly time: number;
}
```

### Future extensions

```typescript
interface Sketch {
  // Colors & styles
  background(color: string): void;
  fill(color: string): void;
  stroke(color: string): void;
  strokeWeight(weight: number): void;
  noFill(): void;
  noStroke(): void;

  // Shapes
  rect(x: number, y: number, w: number, h: number): void;
  ellipse(x: number, y: number, w: number, h: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;

  // State
  readonly time: number;
  readonly frameCount: number;
}
```

## Usage

```typescript
import { ProceduralGenerator } from "@medli/generator-procedural";

// Static background
const gen1 = new ProceduralGenerator((p) => {
  p.background("#ff0000");
});

// Animated background (cycles through colors)
const gen2 = new ProceduralGenerator((p) => {
  const hue = (p.time / 50) % 360;
  p.background(`hsl(${hue}, 100%, 50%)`);
});

// Get a frame
const frame = gen1.frame(0);
// => { backgroundColor: "#ff0000" }
```

## API

### `ProceduralGenerator`

Main generator class implementing the `Generator` interface.

- `constructor(draw: DrawFunction)` - Create with a draw function
- `frame(time: number): Frame` - Run draw function and return frame

### `DrawFunction`

Type for the draw function: `(sketch: Sketch) => void`

### `Sketch`

Context passed to draw function.

- `background(color: string): void` - Set background color
- `time: number` - Current time in milliseconds
