import type {
  Frame,
  Generator,
  Shape,
  Circle as CircleShape,
} from "@medli/spec";

/**
 * SceneObject - base interface for objects that can be added to a scene.
 * Each object contributes to the frame via its frame() method.
 */
export interface SceneObject {
  frame(time: number): Partial<Frame>;
}

/**
 * Background - represents the scene background color.
 *
 * Usage:
 *   const bg = new Background("#ff0000");
 *   scene.setBackground(bg);
 *   bg.color = "#00ff00"; // change color
 */
export class Background implements SceneObject {
  color: string;

  constructor(color = "#000000") {
    this.color = color;
  }

  frame(_time: number): Partial<Frame> {
    return { backgroundColor: this.color };
  }
}

/**
 * Circle - a circle shape with center position and radius.
 *
 * Usage:
 *   const circle = new Circle(50, 50, 25);
 *   scene.add(circle);
 *   circle.x = 60; // move center
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

  frame(_time: number): Partial<Frame> {
    const shape: CircleShape = {
      type: "circle",
      center: { x: this.x, y: this.y },
      radius: this.radius,
    };
    return { shapes: [shape] };
  }
}

/**
 * Scene - the root container and generator for object-oriented scenes.
 *
 * Create a Scene, optionally add a Background and other children.
 * The Scene implements Generator so it can be passed directly to renderers.
 *
 * Usage:
 *   const scene = new Scene();
 *   scene.setBackground(new Background("#ff0000"));
 *   // or
 *   const bg = new Background("#ff0000");
 *   scene.add(bg);
 */
export class Scene implements Generator {
  private _background: Background | null = null;
  private children: SceneObject[] = [];

  /** Get the current background (may be null) */
  get background(): Background | null {
    return this._background;
  }

  /** Set the background (convenience method) */
  setBackground(bg: Background | null): this {
    this._background = bg;
    return this;
  }

  /** Add a generic scene object */
  add(child: SceneObject): this {
    if (child instanceof Background) {
      this._background = child;
    } else {
      this.children.push(child);
    }
    return this;
  }

  /** Remove a scene object */
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

  /**
   * Generate a frame by traversing the scene tree.
   * Merges frame data from background and all children.
   * Shapes arrays are concatenated, other properties are overwritten.
   */
  frame(time: number): Frame {
    const result: Frame = {};
    const allShapes: Shape[] = [];

    // Apply background first
    if (this._background) {
      const bgFrame = this._background.frame(time);
      if (bgFrame.backgroundColor) {
        result.backgroundColor = bgFrame.backgroundColor;
      }
    }

    // Apply children in order, collecting shapes
    for (const child of this.children) {
      const childFrame = child.frame(time);
      if (childFrame.backgroundColor) {
        result.backgroundColor = childFrame.backgroundColor;
      }
      if (childFrame.shapes) {
        allShapes.push(...childFrame.shapes);
      }
    }

    if (allShapes.length > 0) {
      result.shapes = allShapes;
    }

    return result;
  }
}
