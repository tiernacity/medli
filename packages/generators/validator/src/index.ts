import type { Frame, Generator, RenderContext } from "@medli/spec";
import { validateFrame } from "@medli/spec";

/**
 * A pipeline generator that validates frames from an upstream generator.
 *
 * Throws an error if the frame is invalid, otherwise passes it through unchanged.
 * Use this early in a pipeline to fail fast on invalid frames.
 *
 * @example
 * ```typescript
 * const gen = new ProceduralGenerator(draw);
 * const validated = new ValidatorGenerator(gen);
 * // or use the factory function:
 * const validated = withValidation(gen);
 * ```
 */
export class ValidatorGenerator implements Generator {
  constructor(private readonly upstream: Generator) {}

  frame(context: RenderContext): Frame {
    const frame = this.upstream.frame(context);
    const result = validateFrame(frame);
    if (!result.valid) {
      throw new Error(`Frame validation failed: ${result.error}`);
    }
    return frame;
  }
}

/**
 * Factory function to wrap a generator with validation.
 *
 * @param generator - The upstream generator to validate
 * @returns A new generator that validates frames before returning them
 */
export function withValidation(generator: Generator): ValidatorGenerator {
  return new ValidatorGenerator(generator);
}
