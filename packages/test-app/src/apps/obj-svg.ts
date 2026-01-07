/**
 * Object Generator + SVG Renderer
 *
 * Demonstrates three.js-style object-oriented API where you create
 * objects that represent scene elements. In three.js you'd create
 * a Scene, add objects to it, and the renderer draws them.
 */
import type { Frame, Generator } from "@medli/spec";
import { SvgRenderer } from "@medli/renderer-svg";

export interface App {
  start(): void;
  stop(): void;
  setBackgroundColor(color: string): void;
}

/**
 * A Background object - like a three.js scene background.
 */
class Background {
  color: string;

  constructor(color: string) {
    this.color = color;
  }
}

/**
 * Object-oriented generator that holds scene objects.
 * Like a three.js Scene that you add objects to.
 */
class ObjectApp implements Generator {
  background: Background;

  constructor() {
    this.background = new Background("#000000");
  }

  frame(_time: number): Frame {
    return { backgroundColor: this.background.color };
  }
}

export function createApp(element: SVGSVGElement): App {
  const generator = new ObjectApp();
  const renderer = new SvgRenderer(element, generator);

  return {
    start() {
      renderer.loop();
    },
    stop() {
      renderer.stop();
    },
    setBackgroundColor(color: string) {
      // OOP style: modify the object's property
      generator.background.color = color;
    },
  };
}
