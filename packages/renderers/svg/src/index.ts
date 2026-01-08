import type { Generator, Shape } from "@medli/spec";
import { BaseRenderer } from "@medli/renderer-common";

export class SvgRenderer extends BaseRenderer {
  private element: SVGSVGElement;
  private rect: SVGRectElement;
  private shapeElements: SVGElement[] = [];

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

    // Clear previous shape elements
    for (const el of this.shapeElements) {
      el.remove();
    }
    this.shapeElements = [];

    // Render shapes
    if (frame.shapes) {
      for (const shape of frame.shapes) {
        const el = this.renderShape(shape);
        if (el) {
          this.element.appendChild(el);
          this.shapeElements.push(el);
        }
      }
    }
  }

  private renderShape(shape: Shape): SVGElement | null {
    switch (shape.type) {
      case "circle": {
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("cx", String(shape.center.x));
        circle.setAttribute("cy", String(shape.center.y));
        circle.setAttribute("r", String(shape.radius));
        circle.setAttribute("fill", "#000000");
        return circle;
      }
      case "line": {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("x1", String(shape.start.x));
        line.setAttribute("y1", String(shape.start.y));
        line.setAttribute("x2", String(shape.end.x));
        line.setAttribute("y2", String(shape.end.y));
        line.setAttribute("stroke", "#000000");
        line.setAttribute("stroke-width", "5");
        return line;
      }
      default:
        return null;
    }
  }
}
