import type { Generator } from "@medli/spec";
import { BaseRenderer } from "@medli/renderer-common";

export class SvgRenderer extends BaseRenderer {
  private element: SVGSVGElement;
  private rect: SVGRectElement;

  constructor(element: SVGSVGElement, generator: Generator) {
    super(generator);
    this.element = element;

    // Set up 100x100 viewport
    this.element.setAttribute("width", "100");
    this.element.setAttribute("height", "100");
    this.element.setAttribute("viewBox", "0 0 100 100");

    // Create the background rect
    this.rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    this.rect.setAttribute("width", "100");
    this.rect.setAttribute("height", "100");
    this.element.appendChild(this.rect);
  }

  render(time: number = 0): void {
    const frame = this.generator.frame(time);
    this.rect.setAttribute("fill", frame.backgroundColor ?? "#ffffff");
  }
}
