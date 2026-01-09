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
  computeViewportTransform,
  toViewportCoords,
  type Point,
  type ViewportTransformResult,
} from "@medli/renderer-common";

/**
 * Processed image resource containing blob URL and source dimensions.
 * Dimensions are needed for proper crop calculations in SVG.
 */
interface ImageResource {
  url: string;
  width: number;
  height: number;
}

/**
 * Load an image from a blob and return its dimensions along with a blob URL.
 */
function processImageBlob(blob: Blob): Promise<ImageResource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      resolve({
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export class SvgRenderer extends BaseRenderer {
  private svg: SVGSVGElement;
  private rootGroup: SVGGElement;
  private rect: SVGRectElement;
  private shapeElements: SVGElement[] = [];
  private resourceManager: ResourceManager<ImageResource>;
  private clipIdCounter = 0;
  private snapshotUrl: string | null = null;
  private snapshotImage: SVGImageElement | null = null;
  private lastTransform: ViewportTransformResult | null = null;

  constructor(element: SVGSVGElement, generator: Generator) {
    super(generator);
    this.svg = element;

    // Create root group for Y-flip transform (converts Y-up to SVG's Y-down)
    this.rootGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.svg.appendChild(this.rootGroup);

    // Create the background rect (inside rootGroup)
    this.rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    this.rootGroup.appendChild(this.rect);

    // Initialize resource manager for image loading with dimension extraction
    this.resourceManager = new ResourceManager({
      process: processImageBlob,
      dispose: (resource) => URL.revokeObjectURL(resource.url),
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
    let resourceMap: Map<string, ImageResource>;
    try {
      resourceMap = await this.resourceManager.resolveResources(urls);
    } catch (error) {
      console.error("Failed to load resources:", error);
      return;
    }

    // Configure viewport from frame
    const vp = frame.viewport;

    // Get element size from bounding rect and compute transform for toViewportCoords
    const rect = this.svg.getBoundingClientRect();
    const elementWidth = rect.width || 100;
    const elementHeight = rect.height || 100;
    this.lastTransform = computeViewportTransform(
      vp,
      elementWidth,
      elementHeight
    );

    // Set viewBox with center origin
    this.svg.setAttribute(
      "viewBox",
      `${-vp.halfWidth} ${-vp.halfHeight} ${vp.halfWidth * 2} ${vp.halfHeight * 2}`
    );

    // Map scaleMode to preserveAspectRatio
    const preserveAspectRatio = {
      fit: "xMidYMid meet",
      fill: "xMidYMid slice",
      stretch: "none",
    }[vp.scaleMode];
    this.svg.setAttribute("preserveAspectRatio", preserveAspectRatio);

    // Apply Y-flip to root group (converts Y-up to SVG's Y-down)
    this.rootGroup.setAttribute("transform", "scale(1, -1)");

    // Position background rect in viewport coords
    this.rect.setAttribute("x", String(-vp.halfWidth));
    this.rect.setAttribute("y", String(-vp.halfHeight));
    this.rect.setAttribute("width", String(vp.halfWidth * 2));
    this.rect.setAttribute("height", String(vp.halfHeight * 2));

    if (frame.background === undefined) {
      // No background - preserve previous content via snapshot
      if (this.shapeElements.length > 0 || this.snapshotImage) {
        // Capture snapshot BEFORE removing previous snapshot (to include accumulated history)
        const snapshotUrl = await this.captureSnapshot();
        // NOW remove previous snapshot image (data URLs don't need revocation)
        if (this.snapshotImage) {
          this.snapshotImage.remove();
          this.snapshotImage = null;
        }
        // Clear shape elements
        for (const el of this.shapeElements) {
          el.remove();
        }
        this.shapeElements = [];
        // Clear previous clipPath elements from defs
        const defs = this.svg.querySelector("defs");
        if (defs) {
          const clipPaths = defs.querySelectorAll("clipPath");
          clipPaths.forEach((clip) => clip.remove());
        }
        this.insertSnapshotImage(snapshotUrl, vp);
      }
      // Hide background rect
      this.rect.style.display = "none";
    } else {
      // Remove previous snapshot image if exists (data URLs don't need revocation)
      if (this.snapshotImage) {
        this.snapshotImage.remove();
        this.snapshotImage = null;
      }
      this.snapshotUrl = null;
      // Has background - clear and show rect with color
      for (const el of this.shapeElements) {
        el.remove();
      }
      this.shapeElements = [];
      // Clear previous clipPath elements from defs
      const defs = this.svg.querySelector("defs");
      if (defs) {
        const clipPaths = defs.querySelectorAll("clipPath");
        clipPaths.forEach((clip) => clip.remove());
      }
      this.rect.style.display = "";
      this.rect.setAttribute("fill", frame.background);
    }

    // Reset clip ID counter for this render
    this.clipIdCounter = 0;

    // Traverse material tree and render shapes
    this.renderNode(frame.root, [frame.root], this.rootGroup, resourceMap);
  }

  destroy(): void {
    this.stop();
    this.resourceManager.destroy();
    // snapshotUrl is a data URL, no revocation needed
    if (this.snapshotImage) {
      this.snapshotImage.remove();
    }
  }

  /**
   * Transform element coordinates to frame coordinates.
   * @param input - Single point [x, y]
   * @returns Transformed point in frame coordinates
   */
  toViewportCoords(input: Point): Point;
  /**
   * Transform an array of element coordinates to frame coordinates.
   * @param input - Array of points [[x, y], ...]
   * @returns Array of transformed points in frame coordinates
   */
  toViewportCoords(input: Point[]): Point[];
  /**
   * Transform a record of element coordinates to frame coordinates.
   * @param input - Record mapping keys to points
   * @returns Record with same keys, values transformed to frame coordinates
   */
  toViewportCoords<K extends string>(input: Record<K, Point>): Record<K, Point>;
  /**
   * Transform a map of element coordinates to frame coordinates.
   * @param input - Map from keys to points
   * @returns Map with same keys, values transformed to frame coordinates
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

  private async captureSnapshot(): Promise<string> {
    // Returns a data URL which is self-contained and survives SVG serialization.
    // Unlike blob URLs, data URLs don't need revocation.

    // Serialize SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(this.svg);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Load SVG into an image
    const img = new window.Image();
    img.src = svgUrl;
    await img.decode();

    // Get the actual rendered size of the SVG element
    const rect = this.svg.getBoundingClientRect();
    const width = rect.width || 100;
    const height = rect.height || 100;

    // Render to canvas to create a raster image (PNG)
    // This avoids SVG-in-SVG rendering issues
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(svgUrl);
      throw new Error("Could not get canvas context");
    }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(svgUrl);

    // Convert canvas to PNG data URL (self-contained, survives SVG serialization)
    this.snapshotUrl = canvas.toDataURL("image/png");

    return this.snapshotUrl;
  }

  private insertSnapshotImage(
    url: string,
    vp: { halfWidth: number; halfHeight: number }
  ): void {
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image"
    );
    image.setAttribute("href", url);
    // Position image to cover entire viewport in viewBox coordinates
    image.setAttribute("x", String(-vp.halfWidth));
    image.setAttribute("y", String(-vp.halfHeight));
    image.setAttribute("width", String(vp.halfWidth * 2));
    image.setAttribute("height", String(vp.halfHeight * 2));
    // Ensure the raster image fills the viewport without distortion
    image.setAttribute("preserveAspectRatio", "none");
    // Insert BEFORE rootGroup to avoid Y-flip transform
    this.svg.insertBefore(image, this.rootGroup);
    this.snapshotImage = image;
  }

  private renderNode(
    node: FrameNode,
    ancestors: Material[],
    parent: SVGElement,
    resourceMap: Map<string, ImageResource>
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
    resourceMap: Map<string, ImageResource>
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
      case "rectangle": {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect"
        );
        // Convert from center position to top-left corner (SVG rect uses top-left)
        const x = shape.center.x - shape.width / 2;
        const y = shape.center.y - shape.height / 2;
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(shape.width));
        rect.setAttribute("height", String(shape.height));
        rect.setAttribute("fill", material.fill);
        rect.setAttribute("stroke", material.stroke);
        rect.setAttribute("stroke-width", String(material.strokeWidth));
        return rect;
      }
      case "image": {
        const img = shape as Image;
        const resource = resourceMap.get(img.url);
        if (!resource) return null;

        if (img.crop) {
          // Use clipPath to crop the image
          // Scale factors: destination size / crop size
          const scaleX = img.width / img.crop.width;
          const scaleY = img.height / img.crop.height;

          // Destination position (top-left in SVG coords after Y-flip)
          const destX = img.position.x;
          const destY = img.position.y - img.height;

          // Create a group with clipPath
          const group = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g"
          );

          // Generate unique clip ID
          const clipId = `clip-${++this.clipIdCounter}`;

          // Ensure defs exists
          let defs = this.svg.querySelector("defs");
          if (!defs) {
            defs = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "defs"
            );
            this.svg.insertBefore(defs, this.svg.firstChild);
          }

          // Create clipPath with rect at destination position
          const clipPath = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "clipPath"
          );
          clipPath.setAttribute("id", clipId);

          const clipRect = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          clipRect.setAttribute("x", String(destX));
          clipRect.setAttribute("y", String(destY));
          clipRect.setAttribute("width", String(img.width));
          clipRect.setAttribute("height", String(img.height));
          clipPath.appendChild(clipRect);
          defs.appendChild(clipPath);

          // Position the full image so the crop region aligns with destination
          // Image position = dest position - (crop position * scale)
          const imageX = destX - img.crop.x * scaleX;
          const imageY = destY - img.crop.y * scaleY;

          // Full image dimensions when scaled
          const scaledWidth = resource.width * scaleX;
          const scaledHeight = resource.height * scaleY;

          const imageEl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "image"
          );
          imageEl.setAttribute("href", resource.url);
          imageEl.setAttribute("x", String(imageX));
          imageEl.setAttribute("y", String(imageY));
          imageEl.setAttribute("width", String(scaledWidth));
          imageEl.setAttribute("height", String(scaledHeight));

          group.setAttribute("clip-path", `url(#${clipId})`);
          group.appendChild(imageEl);
          return group;
        } else {
          // No crop - use standard image element
          const imageEl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "image"
          );
          imageEl.setAttribute("href", resource.url);
          imageEl.setAttribute("x", String(img.position.x));
          // SVG Y is flipped by the scale(1,-1) transform, so position at y - height
          imageEl.setAttribute("y", String(img.position.y - img.height));
          imageEl.setAttribute("width", String(img.width));
          imageEl.setAttribute("height", String(img.height));
          return imageEl;
        }
      }
      default:
        return null;
    }
  }
}
