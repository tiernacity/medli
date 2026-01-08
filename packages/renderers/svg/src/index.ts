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
  ResourceManager,
  extractResourceUrls,
} from "@medli/renderer-common";

export class SvgRenderer extends BaseRenderer {
  private element: SVGSVGElement;
  private rootGroup: SVGGElement;
  private rect: SVGRectElement;
  private shapeElements: SVGElement[] = [];
  private resourceManager: ResourceManager<string>;

  constructor(element: SVGSVGElement, generator: Generator) {
    super(generator);
    this.element = element;

    // Create root group for Y-flip transform (converts Y-up to SVG's Y-down)
    this.rootGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.element.appendChild(this.rootGroup);

    // Create the background rect (inside rootGroup)
    this.rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    this.rootGroup.appendChild(this.rect);

    // Initialize resource manager for image loading
    this.resourceManager = new ResourceManager({
      process: (blob) => Promise.resolve(URL.createObjectURL(blob)),
      dispose: (url) => URL.revokeObjectURL(url),
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
    this.resourceManager.markNeeded(urls);

    const resourceMap = new Map<string, string>();
    try {
      await Promise.all(
        Array.from(urls).map(async (url) => {
          const resource = await this.resourceManager.getResource(url);
          resourceMap.set(url, resource);
        })
      );
    } catch (error) {
      console.error("Failed to load resources:", error);
      return;
    }

    // Configure viewport from frame
    const vp = frame.viewport;

    // Set viewBox with center origin
    this.element.setAttribute(
      "viewBox",
      `${-vp.halfWidth} ${-vp.halfHeight} ${vp.halfWidth * 2} ${vp.halfHeight * 2}`
    );

    // Map scaleMode to preserveAspectRatio
    const preserveAspectRatio = {
      fit: "xMidYMid meet",
      fill: "xMidYMid slice",
      stretch: "none",
    }[vp.scaleMode];
    this.element.setAttribute("preserveAspectRatio", preserveAspectRatio);

    // Apply Y-flip to root group (converts Y-up to SVG's Y-down)
    this.rootGroup.setAttribute("transform", "scale(1, -1)");

    // Position background rect in viewport coords
    this.rect.setAttribute("x", String(-vp.halfWidth));
    this.rect.setAttribute("y", String(-vp.halfHeight));
    this.rect.setAttribute("width", String(vp.halfWidth * 2));
    this.rect.setAttribute("height", String(vp.halfHeight * 2));
    this.rect.setAttribute("fill", frame.backgroundColor ?? "#ffffff");

    // Clear previous shape elements
    for (const el of this.shapeElements) {
      el.remove();
    }
    this.shapeElements = [];

    // Traverse material tree and render shapes
    this.renderNode(frame.root, [frame.root], this.rootGroup, resourceMap);

    // Cleanup unused resources
    this.resourceManager.pruneUnused();
  }

  destroy(): void {
    this.stop();
    this.resourceManager.destroy();
  }

  private renderNode(
    node: FrameNode,
    ancestors: Material[],
    parent: SVGElement,
    resourceMap: Map<string, string>
  ): void {
    if (node.type === "material") {
      // Material node - recurse into children with updated ancestors
      const material = node as Material;
      for (const child of material.children) {
        if (child.type === "material") {
          this.renderNode(
            child,
            [...ancestors, child as Material],
            parent,
            resourceMap
          );
        } else {
          this.renderNode(child, ancestors, parent, resourceMap);
        }
      }
    } else if (node.type === "transform") {
      // Transform node - create a group with the transform matrix
      const transform = node as Transform;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const [a, b, c, d, e, f] = transform.matrix;
      group.setAttribute("transform", `matrix(${a},${b},${c},${d},${e},${f})`);
      parent.appendChild(group);
      this.shapeElements.push(group);

      // Recurse into children with the group as parent
      // Material ancestors continue through transforms unchanged
      for (const child of transform.children) {
        if (child.type === "material") {
          this.renderNode(
            child,
            [...ancestors, child as Material],
            group,
            resourceMap
          );
        } else {
          this.renderNode(child, ancestors, group, resourceMap);
        }
      }
    } else {
      // Shape node - render with resolved material
      const resolved = resolveMaterial(ancestors);
      const el = this.renderShape(node, resolved, resourceMap);
      if (el) {
        parent.appendChild(el);
        this.shapeElements.push(el);
      }
    }
  }

  private renderShape(
    shape: Shape,
    material: ResolvedMaterial,
    resourceMap: Map<string, string>
  ): SVGElement | null {
    switch (shape.type) {
      case "circle": {
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("cx", String(shape.center.x));
        circle.setAttribute("cy", String(shape.center.y));
        circle.setAttribute("r", String(shape.radius));
        circle.setAttribute("fill", material.fill);
        circle.setAttribute("stroke", material.stroke);
        circle.setAttribute("stroke-width", String(material.strokeWidth));
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
        line.setAttribute("stroke", material.stroke);
        line.setAttribute("stroke-width", String(material.strokeWidth));
        // Lines don't use fill
        return line;
      }
      case "image": {
        const img = shape as Image;
        const blobUrl = resourceMap.get(img.url);
        if (!blobUrl) return null;

        const imageEl = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "image"
        );
        imageEl.setAttribute("href", blobUrl);
        imageEl.setAttribute("x", String(img.position.x));
        // SVG Y is flipped by the scale(1,-1) transform, so position at y - height
        imageEl.setAttribute("y", String(img.position.y - img.height));
        imageEl.setAttribute("width", String(img.width));
        imageEl.setAttribute("height", String(img.height));
        return imageEl;
      }
      default:
        return null;
    }
  }
}
