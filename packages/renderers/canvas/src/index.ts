import type {
  Generator,
  Shape,
  FrameNode,
  Material,
  ResolvedMaterial,
  Transform,
} from "@medli/spec";
import { validateFrame, resolveMaterial } from "@medli/spec";
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

    // Validate frame structure
    const result = validateFrame(frame);
    if (!result.valid) {
      console.error("Invalid frame:", result.error);
      return;
    }

    // Draw background
    this.context.fillStyle = frame.backgroundColor ?? "#ffffff";
    this.context.fillRect(0, 0, 100, 100);

    // Traverse material tree and render shapes
    this.renderNode(frame.root, [frame.root]);
  }

  private renderNode(node: FrameNode, ancestors: Material[]): void {
    if (node.type === "material") {
      // Material node - recurse into children with updated ancestors
      const material = node as Material;
      for (const child of material.children) {
        if (child.type === "material") {
          this.renderNode(child, [...ancestors, child as Material]);
        } else {
          this.renderNode(child, ancestors);
        }
      }
    } else if (node.type === "transform") {
      // Transform node - apply transform, render children, restore state
      const transform = node as Transform;
      const [a, b, c, d, e, f] = transform.matrix;

      this.context.save();
      this.context.transform(a, b, c, d, e, f);

      // Recurse into children - transforms don't affect material ancestor tracking
      for (const child of transform.children) {
        if (child.type === "material") {
          this.renderNode(child, [...ancestors, child as Material]);
        } else {
          this.renderNode(child, ancestors);
        }
      }

      this.context.restore();
    } else {
      // Shape node - render with resolved material
      const resolved = resolveMaterial(ancestors);
      this.renderShape(node as Shape, resolved);
    }
  }

  private renderShape(shape: Shape, material: ResolvedMaterial): void {
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
        this.context.fillStyle = material.fill;
        this.context.fill();
        this.context.strokeStyle = material.stroke;
        this.context.lineWidth = material.strokeWidth;
        this.context.stroke();
        break;
      }
      case "line": {
        this.context.beginPath();
        this.context.moveTo(shape.start.x, shape.start.y);
        this.context.lineTo(shape.end.x, shape.end.y);
        this.context.strokeStyle = material.stroke;
        this.context.lineWidth = material.strokeWidth;
        this.context.stroke();
        break;
      }
    }
  }
}
