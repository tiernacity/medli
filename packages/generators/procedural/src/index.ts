import type {
  Frame,
  Generator,
  Circle,
  Line,
  RootMaterial,
  ChildMaterial,
  FrameNode,
} from "@medli/spec";

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

  /** Draw a line from (x1, y1) to (x2, y2) */
  line(x1: number, y1: number, x2: number, y2: number): void;

  /** Draw a line from (x, y) with offset (dx, dy) */
  lineOffset(x: number, y: number, dx: number, dy: number): void;

  /** Save current style state and start a new nested context */
  push(): void;

  /** Restore previous style state and return to parent context */
  pop(): void;

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
    // Default style state
    let backgroundColor = "#000000";
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
    }
    const contextStack: ContextFrame[] = [];

    // Current context for tracking style changes at the current nesting level
    let currentStyle: StyleState = { ...defaultStyle };
    let currentParentId = "root";
    let currentChildren = rootChildren;
    let currentChildMaterial: ChildMaterial | null = null;
    let hasShapesAtCurrentLevel = false;
    let styleChangedSinceLastShape = false;

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
     * Helper: Add a shape to the current context.
     *
     * Behavior differs based on context:
     * - At ROOT level: All shapes are wrapped in ChildMaterials. When style changes,
     *   a new ChildMaterial is created. Each ChildMaterial includes all explicitly set
     *   style properties (fill, stroke, strokeWidth that were called).
     * - In PUSHED context: Shapes go directly in the pushed ChildMaterial's children,
     *   unless style changes WITHIN the pushed context (then new nested ChildMaterial).
     */
    const addShape = (shape: Circle | Line) => {
      const isAtRootLevel = contextStack.length === 0;

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
            children: [shape],
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
            children: [shape],
          };
          currentChildren.push(currentChildMaterial);
        } else {
          // Same style - add to current ChildMaterial
          if (currentChildMaterial) {
            currentChildMaterial.children.push(shape);
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
          currentChildren.push(shape);
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
            children: [shape],
          };
          currentChildren.push(currentChildMaterial);
        } else {
          // Same style - add to current group
          if (currentChildMaterial) {
            currentChildMaterial.children.push(shape);
          } else {
            currentChildren.push(shape);
          }
        }
      }
    };

    // Create sketch context for this frame
    const sketch: Sketch = {
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
      push() {
        // Lock root style if this is the first operation at root
        if (contextStack.length === 0 && !rootStyleLocked) {
          rootStyle = { ...currentStyle };
          rootStyleLocked = true;
        }

        // Save current context to stack
        contextStack.push({
          parentId: currentParentId,
          parentStyle: { ...currentStyle }, // Capture style at push time
          currentStyle: { ...currentStyle },
          children: currentChildren,
          currentChildMaterial,
          hasShapesAtCurrentLevel,
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

        // Restore parent context
        currentParentId = savedContext.parentId;
        currentStyle = { ...savedContext.currentStyle }; // Restore style
        currentChildren = savedContext.children;
        currentChildMaterial = savedContext.currentChildMaterial;
        hasShapesAtCurrentLevel = savedContext.hasShapesAtCurrentLevel;
        styleChangedSinceLastShape = false;
      },
      time,
    };

    // Run user's draw function
    this.drawFn(sketch);

    // Build root material
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: rootStyle.fill,
      stroke: rootStyle.stroke,
      strokeWidth: rootStyle.strokeWidth,
      children: rootChildren,
    };

    return { backgroundColor, root };
  }
}
