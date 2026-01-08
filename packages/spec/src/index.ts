/**
 * Core specification types for medli
 */

/**
 * A 2D position with x and y coordinates.
 */
export type Position = {
  x: number;
  y: number;
};

/**
 * A circle shape with center position and radius.
 * Rendered as black (no color support yet).
 */
export type Circle = {
  type: "circle";
  center: Position;
  radius: number;
};

/**
 * A line shape from start to end position.
 * Rendered as black with 5px stroke width (no color support yet).
 */
export type Line = {
  type: "line";
  start: Position;
  end: Position;
};

/**
 * Union of all shape types.
 */
export type Shape = Circle | Line;

/**
 * A frame represents the current state to render.
 * All properties are optional - renderers provide defaults.
 */
export type Frame = {
  backgroundColor?: string;
  shapes?: Shape[];
};

/**
 * Generator produces frames based on time.
 */
export interface Generator {
  frame(time: number): Frame;
}

/**
 * Renderer displays frames to the screen.
 * Renders a 100x100 square of the background color.
 * Constructors accept HTML elements of the relevant type.
 * Expects requestAnimationFrame support.
 */
export interface Renderer {
  render(time: number): void;
  loop(): void;
  stop(): void;
}
