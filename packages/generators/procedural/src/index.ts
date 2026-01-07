import type { Frame, Generator } from "@medli/spec";

/**
 * Sketch context - provides procedural drawing functions.
 *
 * This is passed to the draw function each frame, similar to p5.js.
 * Call methods like background() to affect the current frame.
 */
export interface Sketch {
  /** Set the background color for this frame */
  background(color: string): void;

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

    // Create sketch context for this frame
    const sketch: Sketch = {
      background(color: string) {
        backgroundColor = color;
      },
      time,
    };

    // Run user's draw function
    this.drawFn(sketch);

    return { backgroundColor };
  }
}
