import type {
  Frame,
  Generator,
  Circle,
  Line,
  Rectangle,
  Image,
  RootMaterial,
  ChildMaterial,
  FrameNode,
  Transform,
  ScaleMode,
  RenderContext,
  Fragment,
  FragmentGenerator,
  Embed,
  RootMaterialRef,
} from "@medli/spec";
import { resolveFrame } from "@medli/spec";
import {
  translateMatrix,
  rotateMatrix,
  scaleMatrix,
} from "@medli/generator-utils";

/**
 * Sketch context - provides procedural drawing functions.
 *
 * This is passed to the draw function each frame, similar to p5.js.
 * Call methods like background() to affect the current frame.
 */
export interface Sketch {
  /**
   * Set the viewport dimensions. Required - must be called before drawing.
   * Defines a coordinate space with origin at center (0,0) and Y-up.
   * X ranges from -halfWidth to +halfWidth.
   * Y ranges from -halfHeight to +halfHeight.
   */
  viewport(halfWidth: number, halfHeight: number): void;

  /**
   * Set the scale mode for mapping viewport to element.
   * - 'fit': Uniform scale to fit, letterbox/pillarbox empty space (default)
   * - 'fill': Uniform scale to fill, may crop content
   * - 'stretch': Non-uniform scale to exactly fill (distorts aspect ratio)
   */
  scaleMode(mode: ScaleMode): void;

  /** Set the background color for this frame */
  background(color: string): void;

  /** Set the fill color for subsequent shapes */
  fill(color: string): void;

  /** Set the stroke color for subsequent shapes */
  stroke(color: string): void;

  /** Set the stroke width for subsequent shapes */
  strokeWidth(width: number): void;

  /** Draw a circle at (x, y) with given radius */
  circle(x: number, y: number, radius: number): void;

  /** Draw a rectangle centered at (x, y) with given width and height */
  rectangle(x: number, y: number, width: number, height: number): void;

  /** Draw a line from (x1, y1) to (x2, y2) */
  line(x1: number, y1: number, x2: number, y2: number): void;

  /** Draw a line from (x, y) with offset (dx, dy) */
  lineOffset(x: number, y: number, dx: number, dy: number): void;

  /**
   * Draw an image at position (x, y) with given dimensions.
   * Optionally crop the source image by specifying cropX, cropY, cropWidth, cropHeight.
   * Crop coordinates are in source image pixels.
   */
  image(
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
    cropX?: number,
    cropY?: number,
    cropWidth?: number,
    cropHeight?: number
  ): void;

  /** Save current insertion point, start a new nested context */
  push(): void;

  /** Restore previous insertion point */
  pop(): void;

  /** Translate the coordinate system by (x, y) */
  translate(x: number, y: number): void;

  /** Rotate the coordinate system by angle in radians */
  rotate(angle: number): void;

  /** Scale the coordinate system uniformly or non-uniformly */
  scale(s: number): void;
  scale(sx: number, sy: number): void;

  /**
   * Embed a fragment into the current sketch at the current insertion point.
   * The fragment inherits styles from the current material context.
   * @param fragmentGen - A FragmentGenerator or Fragment to embed
   * @param namespace - Unique namespace for this embedding (prevents ID collisions)
   */
  embed(fragmentGen: FragmentGenerator | Fragment, namespace: string): void;

  /**
   * Create a fragment from a draw function.
   * The fragment captures all drawing operations.
   * Note: viewport() and background() are not available in fragment context.
   * @param draw - Draw function that defines the fragment content
   * @returns A Fragment that can be embedded
   */
  createFragment(draw: (p: Sketch) => void): Fragment;

  /** Current time in milliseconds (from requestAnimationFrame) */
  readonly time: number;

  /** Target element width in CSS pixels */
  readonly targetWidth: number;
  /** Target element height in CSS pixels */
  readonly targetHeight: number;
}

/**
 * Draw function type - called each frame with a Sketch context.
 *
 * Like p5.js draw(), this runs every frame. Use the sketch
 * parameter to call procedural drawing functions.
 */
export type DrawFunction = (sketch: Sketch) => void;

/**
 * Procedural Generator - p5.js-style procedural API.
 *
 * Pass a draw function that will be called each frame.
 * Inside the draw function, call sketch.background() etc.
 *
 * Usage:
 *   const gen = new ProceduralGenerator((p) => {
 *     p.background("#ff0000");
 *   });
 */
export class ProceduralGenerator implements Generator {
  private drawFn: DrawFunction;

  constructor(draw: DrawFunction) {
    this.drawFn = draw;
  }

  frame(context: RenderContext): Frame {
    const { time, targetDimensions } = context;
    const [targetWidth, targetHeight] = targetDimensions;

    // Viewport state (must be set by draw function)
    let viewportHalfWidth: number | null = null;
    let viewportHalfHeight: number | null = null;
    let viewportScaleMode: ScaleMode = "fit";
    let backgroundColor: string | undefined = undefined;

    // Default styles for root material
    const defaultFill = "#000000";
    const defaultStroke = "#000000";
    const defaultStrokeWidth = 1;

    // ID counter for materials
    let materialIdCounter = 0;
    const nextMaterialId = () => `m${++materialIdCounter}`;

    // Tree building state
    const rootChildren: FrameNode[] = [];
    let insertionPoint: FrameNode[] = rootChildren;
    let currentParentId = "root";

    // Context stack for push/pop
    interface SavedContext {
      insertionPoint: FrameNode[];
      parentId: string;
    }
    const contextStack: SavedContext[] = [];

    // Create sketch context for this frame
    const sketch: Sketch = {
      viewport(halfWidth: number, halfHeight: number) {
        viewportHalfWidth = halfWidth;
        viewportHalfHeight = halfHeight;
      },

      scaleMode(mode: ScaleMode) {
        viewportScaleMode = mode;
      },

      background(color: string) {
        backgroundColor = color;
      },

      fill(color: string) {
        const material: ChildMaterial = {
          type: "material",
          id: nextMaterialId(),
          ref: currentParentId,
          fill: color,
          children: [],
        };
        insertionPoint.push(material);
        insertionPoint = material.children;
        currentParentId = material.id;
      },

      stroke(color: string) {
        const material: ChildMaterial = {
          type: "material",
          id: nextMaterialId(),
          ref: currentParentId,
          stroke: color,
          children: [],
        };
        insertionPoint.push(material);
        insertionPoint = material.children;
        currentParentId = material.id;
      },

      strokeWidth(width: number) {
        const material: ChildMaterial = {
          type: "material",
          id: nextMaterialId(),
          ref: currentParentId,
          strokeWidth: width,
          children: [],
        };
        insertionPoint.push(material);
        insertionPoint = material.children;
        currentParentId = material.id;
      },

      circle(x: number, y: number, radius: number) {
        const shape: Circle = {
          type: "circle",
          center: { x, y },
          radius,
        };
        insertionPoint.push(shape);
      },

      rectangle(x: number, y: number, width: number, height: number) {
        const shape: Rectangle = {
          type: "rectangle",
          center: { x, y },
          width,
          height,
        };
        insertionPoint.push(shape);
      },

      line(x1: number, y1: number, x2: number, y2: number) {
        const shape: Line = {
          type: "line",
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
        };
        insertionPoint.push(shape);
      },

      lineOffset(x: number, y: number, dx: number, dy: number) {
        const shape: Line = {
          type: "line",
          start: { x, y },
          end: { x: x + dx, y: y + dy },
        };
        insertionPoint.push(shape);
      },

      image(
        url: string,
        x: number,
        y: number,
        width: number,
        height: number,
        cropX?: number,
        cropY?: number,
        cropWidth?: number,
        cropHeight?: number
      ) {
        const shape: Image = {
          type: "image",
          url,
          position: { x, y },
          width,
          height,
          crop:
            cropX !== undefined &&
            cropY !== undefined &&
            cropWidth !== undefined &&
            cropHeight !== undefined
              ? { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
              : undefined,
        };
        insertionPoint.push(shape);
      },

      push() {
        contextStack.push({
          insertionPoint,
          parentId: currentParentId,
        });
      },

      pop() {
        if (contextStack.length === 0) {
          return;
        }
        const saved = contextStack.pop()!;
        insertionPoint = saved.insertionPoint;
        currentParentId = saved.parentId;
      },

      translate(x: number, y: number) {
        const transform: Transform = {
          type: "transform",
          matrix: translateMatrix(x, y),
          children: [],
        };
        insertionPoint.push(transform);
        insertionPoint = transform.children;
      },

      rotate(angle: number) {
        const transform: Transform = {
          type: "transform",
          matrix: rotateMatrix(angle),
          children: [],
        };
        insertionPoint.push(transform);
        insertionPoint = transform.children;
      },

      scale(sx: number, sy?: number) {
        const actualSy = sy === undefined ? sx : sy;
        const transform: Transform = {
          type: "transform",
          matrix: scaleMatrix(sx, actualSy),
          children: [],
        };
        insertionPoint.push(transform);
        insertionPoint = transform.children;
      },

      embed(
        fragmentGen: FragmentGenerator | Fragment,
        namespace: string
      ): void {
        // Get the fragment - either call fragment() method or use directly
        const frag: Fragment =
          "fragment" in fragmentGen
            ? fragmentGen.fragment({
                time,
                targetDimensions: [targetWidth, targetHeight],
              })
            : fragmentGen;

        // Create an Embed node with current material context
        const embedNode: Embed = {
          type: "embed",
          namespace,
          rootMaterialId: currentParentId,
          fragment: frag,
        };

        // Push to insertion point (cast needed since Embed is not in FrameNode)
        insertionPoint.push(embedNode as unknown as FrameNode);
      },

      createFragment(draw: (p: Sketch) => void): Fragment {
        // Create isolated context for fragment drawing
        const fragmentChildren: FrameNode[] = [];
        let fragmentInsertionPoint: FrameNode[] = fragmentChildren;
        let fragmentParentId = "fragment_root";
        const fragmentContextStack: SavedContext[] = [];
        let fragmentMaterialIdCounter = 0;
        const nextFragmentMaterialId = () => `fm${++fragmentMaterialIdCounter}`;

        // Create fragment sketch context (similar to main sketch but isolated)
        const fragmentSketch: Sketch = {
          viewport() {
            throw new Error(
              "viewport() cannot be called inside createFragment() - fragments have no viewport"
            );
          },

          scaleMode() {
            throw new Error(
              "scaleMode() cannot be called inside createFragment() - fragments have no viewport"
            );
          },

          background() {
            throw new Error(
              "background() cannot be called inside createFragment() - fragments have no background"
            );
          },

          fill(color: string) {
            const material: ChildMaterial = {
              type: "material",
              id: nextFragmentMaterialId(),
              ref: fragmentParentId,
              fill: color,
              children: [],
            };
            fragmentInsertionPoint.push(material);
            fragmentInsertionPoint = material.children;
            fragmentParentId = material.id;
          },

          stroke(color: string) {
            const material: ChildMaterial = {
              type: "material",
              id: nextFragmentMaterialId(),
              ref: fragmentParentId,
              stroke: color,
              children: [],
            };
            fragmentInsertionPoint.push(material);
            fragmentInsertionPoint = material.children;
            fragmentParentId = material.id;
          },

          strokeWidth(width: number) {
            const material: ChildMaterial = {
              type: "material",
              id: nextFragmentMaterialId(),
              ref: fragmentParentId,
              strokeWidth: width,
              children: [],
            };
            fragmentInsertionPoint.push(material);
            fragmentInsertionPoint = material.children;
            fragmentParentId = material.id;
          },

          circle(x: number, y: number, radius: number) {
            const shape: Circle = {
              type: "circle",
              center: { x, y },
              radius,
            };
            fragmentInsertionPoint.push(shape);
          },

          rectangle(x: number, y: number, width: number, height: number) {
            const shape: Rectangle = {
              type: "rectangle",
              center: { x, y },
              width,
              height,
            };
            fragmentInsertionPoint.push(shape);
          },

          line(x1: number, y1: number, x2: number, y2: number) {
            const shape: Line = {
              type: "line",
              start: { x: x1, y: y1 },
              end: { x: x2, y: y2 },
            };
            fragmentInsertionPoint.push(shape);
          },

          lineOffset(x: number, y: number, dx: number, dy: number) {
            const shape: Line = {
              type: "line",
              start: { x, y },
              end: { x: x + dx, y: y + dy },
            };
            fragmentInsertionPoint.push(shape);
          },

          image(
            url: string,
            x: number,
            y: number,
            imgWidth: number,
            imgHeight: number,
            cropX?: number,
            cropY?: number,
            cropWidth?: number,
            cropHeight?: number
          ) {
            const shape: Image = {
              type: "image",
              url,
              position: { x, y },
              width: imgWidth,
              height: imgHeight,
              crop:
                cropX !== undefined &&
                cropY !== undefined &&
                cropWidth !== undefined &&
                cropHeight !== undefined
                  ? { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
                  : undefined,
            };
            fragmentInsertionPoint.push(shape);
          },

          push() {
            fragmentContextStack.push({
              insertionPoint: fragmentInsertionPoint,
              parentId: fragmentParentId,
            });
          },

          pop() {
            if (fragmentContextStack.length === 0) {
              return;
            }
            const saved = fragmentContextStack.pop()!;
            fragmentInsertionPoint = saved.insertionPoint;
            fragmentParentId = saved.parentId;
          },

          translate(x: number, y: number) {
            const transform: Transform = {
              type: "transform",
              matrix: translateMatrix(x, y),
              children: [],
            };
            fragmentInsertionPoint.push(transform);
            fragmentInsertionPoint = transform.children;
          },

          rotate(angle: number) {
            const transform: Transform = {
              type: "transform",
              matrix: rotateMatrix(angle),
              children: [],
            };
            fragmentInsertionPoint.push(transform);
            fragmentInsertionPoint = transform.children;
          },

          scale(sx: number, sy?: number) {
            const actualSy = sy === undefined ? sx : sy;
            const transform: Transform = {
              type: "transform",
              matrix: scaleMatrix(sx, actualSy),
              children: [],
            };
            fragmentInsertionPoint.push(transform);
            fragmentInsertionPoint = transform.children;
          },

          embed(fragGen: FragmentGenerator | Fragment, ns: string): void {
            // Get the fragment - either call fragment() method or use directly
            const f: Fragment =
              "fragment" in fragGen
                ? fragGen.fragment({
                    time,
                    targetDimensions: [targetWidth, targetHeight],
                  })
                : fragGen;

            // Create an Embed node with current material context
            const embedNode: Embed = {
              type: "embed",
              namespace: ns,
              rootMaterialId: fragmentParentId,
              fragment: f,
            };

            // Push to insertion point (cast needed since Embed is not in FrameNode)
            fragmentInsertionPoint.push(embedNode as unknown as FrameNode);
          },

          createFragment(innerDraw: (p: Sketch) => void): Fragment {
            // Recursive call - create another fragment context
            return sketch.createFragment(innerDraw);
          },

          time,
          targetWidth,
          targetHeight,
        };

        // Run the draw function with fragment-specific sketch
        draw(fragmentSketch);

        // Create the RootMaterialRef
        const root: RootMaterialRef = {
          type: "root-material-ref",
          id: "fragment_root",
          children: fragmentChildren,
        };

        return { root };
      },

      time,
      targetWidth,
      targetHeight,
    };

    // Run user's draw function
    this.drawFn(sketch);

    // Validate viewport was set
    if (viewportHalfWidth === null || viewportHalfHeight === null) {
      throw new Error(
        "Viewport must be set using p.viewport(halfWidth, halfHeight)"
      );
    }

    // Build root material with defaults
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      children: rootChildren,
    };

    // Build the unresolved frame
    const unresolvedFrame: Frame = {
      viewport: {
        halfWidth: viewportHalfWidth,
        halfHeight: viewportHalfHeight,
        scaleMode: viewportScaleMode,
      },
      background: backgroundColor,
      root,
    };

    // Resolve any embedded fragments before returning
    return resolveFrame(unresolvedFrame);
  }
}
