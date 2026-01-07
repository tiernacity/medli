import type { Generator, Renderer } from "@medli/spec";

export class SvgRenderer implements Renderer {
  private element: SVGSVGElement;
  private generator: Generator;
  private animationId: number | null = null;
  private rect: SVGRectElement;

  constructor(element: SVGSVGElement, generator: Generator) {
    this.element = element;
    this.generator = generator;

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
    this.rect.setAttribute("fill", frame.backgroundColor);
  }

  loop(): void {
    const animate = (time: number) => {
      this.render(time);
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
