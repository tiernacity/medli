import type {
  Generator,
  Shape,
  FrameNode,
  Material,
  ResolvedMaterial,
  Transform,
  Image,
} from "@medli/spec";
import { validateFrame, resolveMaterial } from "@medli/spec";
import {
  BaseRenderer,
  computeViewportTransform,
  ResourceManager,
  extractResourceUrls,
  toViewportCoords,
  type Point,
  type ViewportTransformResult,
} from "@medli/renderer-common";

export class CanvasRenderer extends BaseRenderer {
  private element: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private resourceManager: ResourceManager<ImageBitmap>;
  private lastTransform: ViewportTransformResult | null = null;

  constructor(element: HTMLCanvasElement, generator: Generator) {
    super(generator);
    this.element = element;

    const ctx = this.element.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2d context from canvas");
    }
    this.context = ctx;

    this.resourceManager = new ResourceManager({
      process: (blob) => createImageBitmap(blob),
      dispose: (bitmap) => bitmap.close(),
    });
  }

  async render(time: number = 0): Promise<void> {
    const frame = this.generator.frame(time);

    // Validate frame structure
    const result = validateFrame(frame);
    if (!result.valid) {
      console.error("Invalid frame:", result.error);
      return;
    }

    // Extract and load resources
    const urls = extractResourceUrls(frame);
    let resourceMap: Map<string, ImageBitmap>;
    try {
      resourceMap = await this.resourceManager.resolveResources(urls);
    } catch (error) {
      console.error("Failed to load resources:", error);
      return;
    }

    // Query element size
    const elementWidth = this.element.width;
    const elementHeight = this.element.height;

    // Only clear if background is defined
    if (frame.background !== undefined) {
      this.context.clearRect(0, 0, elementWidth, elementHeight);
    }

    // Compute viewport transform
    const vp = frame.viewport;
    const transform = computeViewportTransform(vp, elementWidth, elementHeight);
    this.lastTransform = transform;

    this.context.save();

    // Translate to center of element
    this.context.translate(transform.translateX, transform.translateY);

    // Scale with Y-flip (negative scaleY flips Y axis)
    this.context.scale(transform.scaleX, -transform.scaleY);

    // Draw background in viewport coordinates (only if defined)
    if (frame.background !== undefined) {
      this.context.fillStyle = frame.background;
      this.context.fillRect(
        -vp.halfWidth,
        -vp.halfHeight,
        vp.halfWidth * 2,
        vp.halfHeight * 2
      );
    }

    // Render all shapes (they're now in viewport coords)
    this.renderNode(frame.root, [frame.root], resourceMap);

    this.context.restore();
  }

  destroy(): void {
    this.stop();
    this.resourceManager.destroy();
  }

  /**
   * Convert element coordinates to frame (viewport) coordinates.
   * @param input - Single point [x, y]
   * @returns Transformed point in frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords(input: Point): Point;
  /**
   * Convert an array of element coordinates to frame (viewport) coordinates.
   * @param input - Array of points [[x, y], ...]
   * @returns Array of transformed points in frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords(input: Point[]): Point[];
  /**
   * Convert a record of element coordinates to frame (viewport) coordinates.
   * @param input - Record mapping keys to points
   * @returns Record with same keys, values transformed to frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords<K extends string>(input: Record<K, Point>): Record<K, Point>;
  /**
   * Convert a map of element coordinates to frame (viewport) coordinates.
   * @param input - Map from keys to points
   * @returns Map with same keys, values transformed to frame coordinates
   * @throws Error if called before first render
   */
  toViewportCoords<K>(input: Map<K, Point>): Map<K, Point>;
  toViewportCoords(
    input: Point | Point[] | Record<string, Point> | Map<unknown, Point>
  ): Point | Point[] | Record<string, Point> | Map<unknown, Point> {
    if (!this.lastTransform) {
      throw new Error("Cannot call toViewportCoords before first render");
    }
    return toViewportCoords(input as Point, this.lastTransform);
  }

  private renderNode(
    node: FrameNode,
    ancestors: Material[],
    resourceMap: Map<string, ImageBitmap>
  ): void {
    if (node.type === "material") {
      // Material node - recurse into children with updated ancestors
      const material = node as Material;
      for (const child of material.children) {
        if (child.type === "material") {
          this.renderNode(
            child,
            [...ancestors, child as Material],
            resourceMap
          );
        } else {
          this.renderNode(child, ancestors, resourceMap);
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
          this.renderNode(
            child,
            [...ancestors, child as Material],
            resourceMap
          );
        } else {
          this.renderNode(child, ancestors, resourceMap);
        }
      }

      this.context.restore();
    } else {
      // Shape node - render with resolved material
      const resolved = resolveMaterial(ancestors);
      this.renderShape(node as Shape, resolved, resourceMap);
    }
  }

  private renderShape(
    shape: Shape,
    material: ResolvedMaterial,
    resourceMap: Map<string, ImageBitmap>
  ): void {
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
        if (material.strokeWidth > 0) {
          this.context.strokeStyle = material.stroke;
          this.context.lineWidth = material.strokeWidth;
          this.context.stroke();
        }
        break;
      }
      case "line": {
        if (material.strokeWidth > 0) {
          this.context.beginPath();
          this.context.moveTo(shape.start.x, shape.start.y);
          this.context.lineTo(shape.end.x, shape.end.y);
          this.context.strokeStyle = material.stroke;
          this.context.lineWidth = material.strokeWidth;
          this.context.stroke();
        }
        break;
      }
      case "rectangle": {
        // Convert from center position to top-left corner
        const x = shape.center.x - shape.width / 2;
        const y = shape.center.y - shape.height / 2;
        this.context.beginPath();
        this.context.rect(x, y, shape.width, shape.height);
        this.context.fillStyle = material.fill;
        this.context.fill();
        if (material.strokeWidth > 0) {
          this.context.strokeStyle = material.stroke;
          this.context.lineWidth = material.strokeWidth;
          this.context.stroke();
        }
        break;
      }
      case "image": {
        const img = shape as Image;
        const bitmap = resourceMap.get(img.url);
        if (bitmap) {
          if (img.crop) {
            // 9-param: drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            this.context.drawImage(
              bitmap,
              img.crop.x,
              img.crop.y,
              img.crop.width,
              img.crop.height,
              img.position.x,
              img.position.y - img.height,
              img.width,
              img.height
            );
          } else {
            // 5-param: drawImage(image, dx, dy, dWidth, dHeight)
            this.context.drawImage(
              bitmap,
              img.position.x,
              img.position.y - img.height,
              img.width,
              img.height
            );
          }
        }
        break;
      }
    }
  }
}
