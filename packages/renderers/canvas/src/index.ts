import type { Generator, Renderer } from "@medli/spec";

export class CanvasRenderer implements Renderer {
  private element: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private generator: Generator;
  private animationId: number | null = null;

  constructor(element: HTMLCanvasElement, generator: Generator) {
    this.element = element;
    this.generator = generator;

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
    this.context.fillStyle = frame.backgroundColor;
    this.context.fillRect(0, 0, 100, 100);
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
