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
  Matrix2D,
  Transform,
  ScaleMode,
} from "@medli/spec";

// ============================================================================
// Matrix2D helpers for 2D affine transformations
// ============================================================================

/**
 * Returns the identity matrix [1, 0, 0, 1, 0, 0].
 */
function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Returns a translation matrix.
 * | 1  0  x |
 * | 0  1  y |
 * | 0  0  1 |
 */
function translateMatrix(x: number, y: number): Matrix2D {
  return [1, 0, 0, 1, x, y];
}

/**
 * Returns a rotation matrix for angle in radians.
 * | cos  -sin  0 |
 * | sin   cos  0 |
 * | 0     0    1 |
 */
function rotateMatrix(angle: number): Matrix2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * Returns a scale matrix.
 * | sx  0   0 |
 * | 0   sy  0 |
 * | 0   0   1 |
 */
function scaleMatrix(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Multiplies two matrices: result = a * b.
 * Matrix format: [a, b, c, d, e, f] represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 */
function multiplyMatrices(a: Matrix2D, b: Matrix2D): Matrix2D {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;

  return [
    a0 * b0 + a2 * b1, // new a
    a1 * b0 + a3 * b1, // new b
    a0 * b2 + a2 * b3, // new c
    a1 * b2 + a3 * b3, // new d
    a0 * b4 + a2 * b5 + a4, // new e
    a1 * b4 + a3 * b5 + a5, // new f
  ];
}

/**
 * Checks if a matrix is the identity matrix.
 */
function isIdentity(m: Matrix2D): boolean {
  return (
    m[0] === 1 &&
    m[1] === 0 &&
    m[2] === 0 &&
    m[3] === 1 &&
    m[4] === 0 &&
    m[5] === 0
  );
}

/**
 * Internal style state for tracking fill, stroke, strokeWidth.
 */
interface StyleState {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

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

  /** Save current style and transform state, start a new nested context */
  push(): void;

  /** Restore previous style and transform state, return to parent context */
  pop(): void;

  /** Translate the coordinate system by (x, y) */
  translate(x: number, y: number): void;

  /** Rotate the coordinate system by angle in radians */
  rotate(angle: number): void;

  /** Scale the coordinate system uniformly or non-uniformly */
  scale(s: number): void;
  scale(sx: number, sy: number): void;

  /** Current time in milliseconds (from requestAnimationFrame) */
  readonly time: number;
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

  frame(time: number = 0): Frame {
    // Viewport state (must be set by draw function)
    let viewportHalfWidth: number | null = null;
    let viewportHalfHeight: number | null = null;
    let viewportScaleMode: ScaleMode = "fit";

    // Default style state
    let backgroundColor: string | undefined = undefined;
    const defaultStyle: StyleState = {
      fill: "#000000",
      stroke: "#000000",
      strokeWidth: 1,
    };

    // ID counter for generating unique ChildMaterial IDs
    let materialIdCounter = 0;
    const nextMaterialId = () => `m${++materialIdCounter}`;

    // Root-level state tracking
    let rootStyle: StyleState = { ...defaultStyle };
    let rootStyleLocked = false; // Once first shape at root, lock root style
    const rootChildren: FrameNode[] = [];

    // Stack for push/pop - stores the full context we need to restore
    interface ContextFrame {
      parentId: string;
      parentStyle: StyleState; // Style at time of push (for diff calculation)
      currentStyle: StyleState; // Current style (may be modified)
      children: FrameNode[]; // Children for this context's material
      currentChildMaterial: ChildMaterial | null;
      hasShapesAtCurrentLevel: boolean;
      transform: Matrix2D; // Transform at time of push
    }
    const contextStack: ContextFrame[] = [];

    // Current context for tracking style changes at the current nesting level
    let currentStyle: StyleState = { ...defaultStyle };
    let currentParentId = "root";
    let currentChildren = rootChildren;
    let currentChildMaterial: ChildMaterial | null = null;
    let hasShapesAtCurrentLevel = false;
    let styleChangedSinceLastShape = false;

    // Current transform state
    let currentTransform: Matrix2D = identityMatrix();

    /**
     * Helper: Get style diff between current and parent style.
     * Returns only properties that differ (for ChildMaterial).
     */
    const getStyleDiff = (
      current: StyleState,
      parent: StyleState
    ): { fill?: string; stroke?: string; strokeWidth?: number } => {
      const diff: { fill?: string; stroke?: string; strokeWidth?: number } = {};
      if (current.fill !== parent.fill) diff.fill = current.fill;
      if (current.stroke !== parent.stroke) diff.stroke = current.stroke;
      if (current.strokeWidth !== parent.strokeWidth)
        diff.strokeWidth = current.strokeWidth;
      return diff;
    };

    /**
     * Helper: Get the parent style for diff calculations.
     * At root level, uses rootStyle. In pushed contexts, uses the parentStyle from push.
     */
    const getParentStyle = (): StyleState => {
      if (contextStack.length === 0) {
        return rootStyle;
      }
      // In a pushed context, the parent style is what was captured at push time
      return contextStack[contextStack.length - 1].parentStyle;
    };

    // Track which properties were explicitly set via fill()/stroke()/strokeWidth()
    // This helps us know what to include in ChildMaterials
    let fillWasSet = false;
    let strokeWasSet = false;
    let strokeWidthWasSet = false;

    /**
     * Helper: Get style properties to include in a ChildMaterial at root level.
     * Includes any property that was explicitly set (regardless of whether it differs from root).
     */
    const getRootChildStyle = (): {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    } => {
      const style: { fill?: string; stroke?: string; strokeWidth?: number } =
        {};
      if (fillWasSet) style.fill = currentStyle.fill;
      if (strokeWasSet) style.stroke = currentStyle.stroke;
      if (strokeWidthWasSet) style.strokeWidth = currentStyle.strokeWidth;
      return style;
    };

    /**
     * Helper: Wrap a shape in a Transform node if the current transform is not identity.
     */
    const wrapWithTransform = (
      shape: Circle | Rectangle | Line | Image
    ): FrameNode => {
      if (isIdentity(currentTransform)) {
        return shape;
      }
      const transformNode: Transform = {
        type: "transform",
        matrix: [...currentTransform] as Matrix2D,
        children: [shape],
      };
      return transformNode;
    };

    /**
     * Helper: Add a shape to the current context.
     *
     * Behavior differs based on context:
     * - At ROOT level: All shapes are wrapped in ChildMaterials. When style changes,
     *   a new ChildMaterial is created. Each ChildMaterial includes all explicitly set
     *   style properties (fill, stroke, strokeWidth that were called).
     * - In PUSHED context: Shapes go directly in the pushed ChildMaterial's children,
     *   unless style changes WITHIN the pushed context (then new nested ChildMaterial).
     * - If a transform is active, the shape is wrapped in a Transform node.
     */
    const addShape = (shape: Circle | Rectangle | Line | Image) => {
      const isAtRootLevel = contextStack.length === 0;
      const node = wrapWithTransform(shape);

      if (isAtRootLevel) {
        // First shape at root locks in root style
        if (!rootStyleLocked) {
          rootStyle = { ...currentStyle };
          rootStyleLocked = true;
        }

        // ROOT LEVEL: Always wrap shapes in ChildMaterials with explicit style
        if (!hasShapesAtCurrentLevel) {
          // First shape at root level - create ChildMaterial
          hasShapesAtCurrentLevel = true;
          styleChangedSinceLastShape = false;

          // Include all explicitly set style properties
          const style = getRootChildStyle();
          const id = nextMaterialId();
          currentChildMaterial = {
            type: "material",
            id,
            ref: currentParentId,
            ...style,
            children: [node],
          };
          currentChildren.push(currentChildMaterial);
        } else if (styleChangedSinceLastShape) {
          // Style changed between shapes - new ChildMaterial
          styleChangedSinceLastShape = false;

          // Include all explicitly set style properties
          const style = getRootChildStyle();
          const id = nextMaterialId();
          currentChildMaterial = {
            type: "material",
            id,
            ref: currentParentId,
            ...style,
            children: [node],
          };
          currentChildren.push(currentChildMaterial);
        } else {
          // Same style - add to current ChildMaterial
          if (currentChildMaterial) {
            currentChildMaterial.children.push(node);
          }
        }
      } else {
        // PUSHED CONTEXT: Shapes go directly in the pushed ChildMaterial
        // unless style changes within this context
        const parentStyle = getParentStyle();

        if (!hasShapesAtCurrentLevel) {
          // First shape in pushed context - goes directly in children
          hasShapesAtCurrentLevel = true;
          styleChangedSinceLastShape = false;
          currentChildren.push(node);
        } else if (styleChangedSinceLastShape) {
          // Style changed within pushed context - create nested ChildMaterial
          styleChangedSinceLastShape = false;

          const diff = getStyleDiff(currentStyle, parentStyle);
          const id = nextMaterialId();
          currentChildMaterial = {
            type: "material",
            id,
            ref: currentParentId,
            ...diff,
            children: [node],
          };
          currentChildren.push(currentChildMaterial);
        } else {
          // Same style - add to current group
          if (currentChildMaterial) {
            currentChildMaterial.children.push(node);
          } else {
            currentChildren.push(node);
          }
        }
      }
    };

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
        currentStyle.fill = color;
        styleChangedSinceLastShape = true;
        fillWasSet = true;
      },
      stroke(color: string) {
        currentStyle.stroke = color;
        styleChangedSinceLastShape = true;
        strokeWasSet = true;
      },
      strokeWidth(width: number) {
        currentStyle.strokeWidth = width;
        styleChangedSinceLastShape = true;
        strokeWidthWasSet = true;
      },
      circle(x: number, y: number, radius: number) {
        const circleShape: Circle = {
          type: "circle",
          center: { x, y },
          radius,
        };
        addShape(circleShape);
      },
      rectangle(x: number, y: number, width: number, height: number) {
        const rectangleShape: Rectangle = {
          type: "rectangle",
          center: { x, y },
          width,
          height,
        };
        addShape(rectangleShape);
      },
      line(x1: number, y1: number, x2: number, y2: number) {
        const lineShape: Line = {
          type: "line",
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
        };
        addShape(lineShape);
      },
      lineOffset(x: number, y: number, dx: number, dy: number) {
        const lineShape: Line = {
          type: "line",
          start: { x, y },
          end: { x: x + dx, y: y + dy },
        };
        addShape(lineShape);
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
        const imageShape: Image = {
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
        addShape(imageShape);
      },
      push() {
        // Lock root style if this is the first operation at root
        if (contextStack.length === 0 && !rootStyleLocked) {
          rootStyle = { ...currentStyle };
          rootStyleLocked = true;
        }

        // Save current context to stack (including transform state)
        contextStack.push({
          parentId: currentParentId,
          parentStyle: { ...currentStyle }, // Capture style at push time
          currentStyle: { ...currentStyle },
          children: currentChildren,
          currentChildMaterial,
          hasShapesAtCurrentLevel,
          transform: [...currentTransform] as Matrix2D,
        });

        // Create new nested context
        const newId = nextMaterialId();
        const newChildren: FrameNode[] = [];

        // Create a ChildMaterial for this pushed context
        // Style diff will be calculated when shapes are added or at pop
        const childMaterial: ChildMaterial = {
          type: "material",
          id: newId,
          ref: currentParentId,
          children: newChildren,
        };
        currentChildren.push(childMaterial);

        // Update current context
        currentParentId = newId;
        currentChildren = newChildren;
        currentChildMaterial = null;
        hasShapesAtCurrentLevel = false;
        styleChangedSinceLastShape = false;
        // Note: currentTransform is NOT reset - transforms accumulate until pop()
      },
      pop() {
        if (contextStack.length === 0) {
          // No-op if stack is empty (can't pop past root)
          return;
        }

        // Get the context we're popping from
        const savedContext = contextStack.pop()!;

        // Find the ChildMaterial we created in push() and update its style diff
        const pushedMaterial = savedContext.children.find(
          (child) =>
            child.type === "material" &&
            (child as ChildMaterial).id === currentParentId
        ) as ChildMaterial | undefined;

        if (pushedMaterial) {
          // Calculate diff from parent style at time of push
          const diff = getStyleDiff(currentStyle, savedContext.parentStyle);
          if (diff.fill !== undefined) pushedMaterial.fill = diff.fill;
          if (diff.stroke !== undefined) pushedMaterial.stroke = diff.stroke;
          if (diff.strokeWidth !== undefined)
            pushedMaterial.strokeWidth = diff.strokeWidth;
        }

        // Restore parent context (including transform)
        currentParentId = savedContext.parentId;
        currentStyle = { ...savedContext.currentStyle }; // Restore style
        currentChildren = savedContext.children;
        currentChildMaterial = savedContext.currentChildMaterial;
        hasShapesAtCurrentLevel = savedContext.hasShapesAtCurrentLevel;
        styleChangedSinceLastShape = false;
        currentTransform = [...savedContext.transform] as Matrix2D; // Restore transform
      },
      translate(x: number, y: number) {
        currentTransform = multiplyMatrices(
          currentTransform,
          translateMatrix(x, y)
        );
      },
      rotate(angle: number) {
        currentTransform = multiplyMatrices(
          currentTransform,
          rotateMatrix(angle)
        );
      },
      scale(sx: number, sy?: number) {
        // If only one argument, use it for both sx and sy (uniform scale)
        const actualSy = sy === undefined ? sx : sy;
        currentTransform = multiplyMatrices(
          currentTransform,
          scaleMatrix(sx, actualSy)
        );
      },
      time,
    };

    // Run user's draw function
    this.drawFn(sketch);

    // Validate viewport was set
    if (viewportHalfWidth === null || viewportHalfHeight === null) {
      throw new Error(
        "Viewport must be set using p.viewport(halfWidth, halfHeight)"
      );
    }

    // Build root material
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: rootStyle.fill,
      stroke: rootStyle.stroke,
      strokeWidth: rootStyle.strokeWidth,
      children: rootChildren,
    };

    return {
      viewport: {
        halfWidth: viewportHalfWidth,
        halfHeight: viewportHalfHeight,
        scaleMode: viewportScaleMode,
      },
      background: backgroundColor,
      root,
    };
  }
}
