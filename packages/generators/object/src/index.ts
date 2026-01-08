import type {
  Frame,
  Generator,
  Circle as CircleShape,
  Line as LineShape,
  RootMaterial,
  FrameNode,
} from "@medli/spec";

/**
 * SceneObject - base interface for objects that can be added to a scene.
 * Each object contributes FrameNodes (shapes) to the frame.
 */
export interface SceneObject {
  frame(time: number): FrameNode[];
}

/**
 * Background - represents the scene background color.
 * Does not contribute shapes, only sets backgroundColor on Scene.
 */
export class Background implements SceneObject {
  color: string;

  constructor(color = "#000000") {
    this.color = color;
  }

  frame(_time: number): FrameNode[] {
    // Background doesn't add shapes, it's handled specially by Scene
    return [];
  }
}

/**
 * Circle - a circle shape with center position and radius.
 */
export class Circle implements SceneObject {
  x: number;
  y: number;
  radius: number;

  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  frame(_time: number): FrameNode[] {
    const shape: CircleShape = {
      type: "circle",
      center: { x: this.x, y: this.y },
      radius: this.radius,
    };
    return [shape];
  }
}

/**
 * Line - a line from start to end position.
 */
export class Line implements SceneObject {
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  static fromOffset(x: number, y: number, dx: number, dy: number): Line {
    return new Line(x, y, x + dx, y + dy);
  }

  frame(_time: number): FrameNode[] {
    const shape: LineShape = {
      type: "line",
      start: { x: this.x1, y: this.y1 },
      end: { x: this.x2, y: this.y2 },
    };
    return [shape];
  }
}

/**
 * Scene - the root container and generator for object-oriented scenes.
 * Builds a Material-based tree from its children.
 */
export class Scene implements Generator {
  private _background: Background | null = null;
  private children: SceneObject[] = [];

  // Default material properties
  fill = "#000000";
  stroke = "#000000";
  strokeWidth = 1;

  get background(): Background | null {
    return this._background;
  }

  setBackground(bg: Background | null): this {
    this._background = bg;
    return this;
  }

  add(child: SceneObject): this {
    if (child instanceof Background) {
      this._background = child;
    } else {
      this.children.push(child);
    }
    return this;
  }

  remove(child: SceneObject): this {
    if (child === this._background) {
      this._background = null;
    } else {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
      }
    }
    return this;
  }

  frame(time: number): Frame {
    // Collect shapes from all children
    const allShapes: FrameNode[] = [];
    for (const child of this.children) {
      allShapes.push(...child.frame(time));
    }

    // Build root material with all shapes as children
    const root: RootMaterial = {
      type: "material",
      id: "root",
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      children: allShapes,
    };

    // Get background color
    const backgroundColor = this._background?.color;

    return { backgroundColor, root };
  }
}
