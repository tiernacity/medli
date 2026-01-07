/**
 * Procedural Generator + SVG Renderer
 *
 * Demonstrates p5.js-style procedural API where you call functions
 * to build up the frame state. In p5.js you'd call background(color)
 * to set the background - here we simulate that with mutable state.
 */
import type { Frame, Generator } from "@medli/spec";
import { SvgRenderer } from "@medli/renderer-svg";

export interface App {
  start(): void;
  stop(): void;
  setBackgroundColor(color: string): void;
}

/**
 * Procedural-style generator with mutable state.
 * Call setBackgroundColor() like you'd call background() in p5.js.
 */
class ProceduralApp implements Generator {
  private _backgroundColor = "#000000";

  // Procedural API: call this to change the background
  background(color: string): void {
    this._backgroundColor = color;
  }

  frame(_time: number): Frame {
    return { backgroundColor: this._backgroundColor };
  }
}

export function createApp(element: SVGSVGElement): App {
  const generator = new ProceduralApp();
  const renderer = new SvgRenderer(element, generator);

  return {
    start() {
      renderer.loop();
    },
    stop() {
      renderer.stop();
    },
    setBackgroundColor(color: string) {
      generator.background(color);
    },
  };
}
