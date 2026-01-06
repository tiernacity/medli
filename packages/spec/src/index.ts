/**
 * Core specification types for medli
 */

export interface Shape {
  type: string;
  x: number;
  y: number;
}

export interface Generator<T extends Shape = Shape> {
  generate(): T[];
}

export interface Renderer<T extends Shape = Shape> {
  render(shapes: T[]): void;
}
