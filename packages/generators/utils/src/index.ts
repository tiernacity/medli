import type { Matrix2D } from "@medli/spec";

/**
 * Create an identity matrix [1,0,0,1,0,0].
 */
export function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Create a translation matrix.
 * [1, 0, 0, 1, x, y]
 */
export function translateMatrix(x: number, y: number): Matrix2D {
  return [1, 0, 0, 1, x, y];
}

/**
 * Create a rotation matrix for the given angle in radians.
 * [cos(a), sin(a), -sin(a), cos(a), 0, 0]
 */
export function rotateMatrix(angle: number): Matrix2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * Create a scale matrix.
 * [sx, 0, 0, sy, 0, 0]
 */
export function scaleMatrix(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Multiply two 2D affine matrices.
 * Result = a * b
 *
 * When applied to a point: (a * b) * point = a * (b * point)
 * So b is applied first, then a.
 *
 * Matrix format: [a, b, c, d, e, f] represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 */
export function multiplyMatrices(a: Matrix2D, b: Matrix2D): Matrix2D {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;

  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ];
}

/**
 * Check if a matrix is the identity matrix.
 */
export function isIdentityMatrix(m: Matrix2D): boolean {
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
 * Check if two matrices are approximately equal within epsilon.
 */
export function matricesEqual(
  a: Matrix2D,
  b: Matrix2D,
  epsilon = 1e-10
): boolean {
  return (
    Math.abs(a[0] - b[0]) < epsilon &&
    Math.abs(a[1] - b[1]) < epsilon &&
    Math.abs(a[2] - b[2]) < epsilon &&
    Math.abs(a[3] - b[3]) < epsilon &&
    Math.abs(a[4] - b[4]) < epsilon &&
    Math.abs(a[5] - b[5]) < epsilon
  );
}
