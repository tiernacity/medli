import type {
  Frame,
  Generator,
  Circle,
  Line,
  RootMaterial,
  FrameNode,
} from "@medli/spec";

/**
 * Sketch context - provides procedural drawing functions.
 *
 * This is passed to the draw function each frame, similar to p5.js.
 * Call methods like background() to affect the current frame.
 */
export interface Sketch {
  /** Set the background color for this frame */
  background(color: string): void;

  /** Set the fill color for subsequent shapes */
  fill(color: string): void;

  /** Set the stroke color for subsequent shapes */
  stroke(color: string): void;

  /** Set the stroke width for subsequent shapes */
  strokeWidth(width: number): void;

  /** Draw a circle at (x, y) with given radius */
  circle(x: number, y: number, radius: number): void;

  /** Draw a line from (x1, y1) to (x2, y2) */
  line(x1: number, y1: number, x2: number, y2: number): void;

  /** Draw a line from (x, y) with offset (dx, dy) */
  lineOffset(x: number, y: number, dx: number, dy: number): void;

  /** Current time in milliseconds (from requestAnimationFrame) */
  readonly time: number;
}

/**
 * Draw function type - called each frame with a Sketch context.
 *
 * Like p5.js draw(), this runs every frame. Use the sketch
 * parameter to call procedural drawing functions.
 */
export type DrawFunction = (sketch: Sketch) => void;

/**
 * Procedural Generator - p5.js-style procedural API.
 *
 * Pass a draw function that will be called each frame.
 * Inside the draw function, call sketch.background() etc.
 *
 * Usage:
 *   const gen = new ProceduralGenerator((p) => {
 *     p.background("#ff0000");
 *   });
 */
export class ProceduralGenerator implements Generator {
  private drawFn: DrawFunction;

  constructor(draw: DrawFunction) {
    this.drawFn = draw;
  }

  frame(time: number = 0): Frame {
    // Default style state
    let backgroundColor = "#000000";
    let currentFill = "#000000";
    let currentStroke = "#000000";
    let currentStrokeWidth = 1;

    // Collect shapes (for now, flat list under root material)
    const shapes: FrameNode[] = [];

    // Create sketch context for this frame
    const sketch: Sketch = {
      background(color: string) {
        backgroundColor = color;
      },
      fill(color: string) {
        currentFill = color;
      },
      stroke(color: string) {
        currentStroke = color;
      },
      strokeWidth(width: number) {
        currentStrokeWidth = width;
      },
      circle(x: number, y: number, radius: number) {
        const circleShape: Circle = {
          type: "circle",
          center: { x, y },
          radius,
        };
        shapes.push(circleShape);
      },
      line(x1: number, y1: number, x2: number, y2: number) {
        const lineShape: Line = {
          type: "line",
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
        };
        shapes.push(lineShape);
      },
      lineOffset(x: number, y: number, dx: number, dy: number) {
        const lineShape: Line = {
          type: "line",
          start: { x, y },
          end: { x: x + dx, y: y + dy },
        };
        shapes.push(lineShape);
      },
      time,
    };

    // Run user's draw function
    this.drawFn(sketch);

    // Build root material with all shapes as children
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: currentFill,
      stroke: currentStroke,
      strokeWidth: currentStrokeWidth,
      children: shapes,
    };

    return { backgroundColor, root };
  }
}
