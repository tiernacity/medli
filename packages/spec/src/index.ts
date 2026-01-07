/**
 * Core specification types for medli
 */

/**
 * A frame represents the current state to render.
 * Contains only a background color for now.
 */
export type Frame = {
  backgroundColor: string;
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
