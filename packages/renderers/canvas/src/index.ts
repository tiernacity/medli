import type { Renderer, Shape } from "@medli/spec";

export interface CanvasContext {
  fillRect(x: number, y: number, width: number, height: number): void;
}

export interface CanvasRendererConfig {
  context: CanvasContext;
}

export class CanvasRenderer implements Renderer {
  private config: CanvasRendererConfig;

  constructor(config: CanvasRendererConfig) {
    this.config = config;
  }

  render(shapes: Shape[]): void {
    const { context } = this.config;
    for (const shape of shapes) {
      context.fillRect(shape.x, shape.y, 1, 1);
    }
  }
}
