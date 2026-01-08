import type { Generator, Shape } from "@medli/spec";
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

    // Draw background
    this.context.fillStyle = frame.backgroundColor ?? "#ffffff";
    this.context.fillRect(0, 0, 100, 100);

    // Render shapes
    if (frame.shapes) {
      for (const shape of frame.shapes) {
        this.renderShape(shape);
      }
    }
  }

  private renderShape(shape: Shape): void {
    switch (shape.type) {
      case "circle": {
        this.context.beginPath();
        this.context.arc(
          shape.center.x,
          shape.center.y,
          shape.radius,
          0,
          Math.PI * 2
        );
        this.context.fillStyle = "#000000";
        this.context.fill();
        break;
      }
    }
  }
}
