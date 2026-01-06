import type { Renderer, Shape } from "@medli/spec";

export interface SvgRendererConfig {
  width: number;
  height: number;
}

export class SvgRenderer implements Renderer {
  private config: SvgRendererConfig;

  constructor(config: SvgRendererConfig) {
    this.config = config;
  }

  render(shapes: Shape[]): void {
    const { width, height } = this.config;
    console.log(`<svg width="${width}" height="${height}">`);
    for (const shape of shapes) {
      console.log(`  <circle cx="${shape.x}" cy="${shape.y}" r="1" />`);
    }
    console.log("</svg>");
  }
}
