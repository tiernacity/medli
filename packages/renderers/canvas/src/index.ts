import type { Generator } from "@medli/spec";
import { BaseRenderer } from "@medli/renderer-common";

export class CanvasRenderer extends BaseRenderer {
  private element: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(element: HTMLCanvasElement, generator: Generator) {
    super(generator);
    this.element = element;

    // Set up 100x100 canvas
    this.element.width = 100;
    this.element.height = 100;

    const ctx = this.element.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2d context from canvas");
    }
    this.context = ctx;
  }

  render(time: number = 0): void {
    const frame = this.generator.frame(time);
    this.context.fillStyle = frame.backgroundColor ?? "#ffffff";
    this.context.fillRect(0, 0, 100, 100);
  }
}
