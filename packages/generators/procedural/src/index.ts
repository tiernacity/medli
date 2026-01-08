import type { Frame, Generator, Shape, Circle, Line } from "@medli/spec";

/**
 * Sketch context - provides procedural drawing functions.
 *
 * This is passed to the draw function each frame, similar to p5.js.
 * Call methods like background() to affect the current frame.
 */
export interface Sketch {
  /** Set the background color for this frame */
  background(color: string): void;

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
    // Start with default frame state
    let backgroundColor = "#000000";
    const shapes: Shape[] = [];

    // Create sketch context for this frame
    const sketch: Sketch = {
      background(color: string) {
        backgroundColor = color;
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

    return { backgroundColor, shapes };
  }
}
