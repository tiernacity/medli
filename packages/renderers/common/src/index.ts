import type {
  Generator,
  Renderer,
  Viewport,
  Frame,
  FrameNode,
} from "@medli/spec";
import { mapValues } from "es-toolkit/object";

/**
 * Post-processor for transforming fetched blobs into renderer-specific resources.
 * Each renderer provides its own implementation.
 */
export interface ResourcePostProcessor<T> {
  /** Transform a fetched blob into the renderer's resource format */
  process(blob: Blob): Promise<T>;
  /** Clean up a resource when it's no longer needed */
  dispose(resource: T): void;
}

type ResourceState<T> =
  | { status: "loading"; promise: Promise<Blob> }
  | { status: "ready"; blob: Blob; processed: T }
  | { status: "error"; error: Error };

/**
 * Manages external resources (images, etc.) for a renderer.
 * Handles fetching, caching, post-processing, and disposal.
 */
export class ResourceManager<T> {
  private postProcessor: ResourcePostProcessor<T>;
  private resources = new Map<string, ResourceState<T>>();

  constructor(postProcessor: ResourcePostProcessor<T>) {
    this.postProcessor = postProcessor;
  }

  /**
   * Resolve all requested resources.
   *
   * This is the single method renderers should call:
   * 1. Fetches any URLs not already cached
   * 2. Returns Map of URL -> processed resource for all requested URLs
   * 3. Prunes resources no longer needed (cached but not in the requested set)
   *
   * @param urls - Set of URLs needed
   * @returns Map of URL to processed resource for all requested URLs
   * @throws If any fetch or processing fails
   */
  async resolveResources(urls: Set<string>): Promise<Map<string, T>> {
    // Fetch and process all requested URLs
    const result = new Map<string, T>();

    await Promise.all(
      Array.from(urls).map(async (url) => {
        const resource = await this.getResource(url);
        result.set(url, resource);
      })
    );

    // Prune resources no longer needed
    this.pruneUnused(urls);

    return result;
  }

  /**
   * Get a resource by URL, fetching and processing if needed.
   * Internal method - renderers should use resolveResources() instead.
   */
  private async getResource(url: string): Promise<T> {
    let state = this.resources.get(url);

    if (!state) {
      // Start loading
      const promise = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
        return r.blob();
      });
      state = { status: "loading", promise };
      this.resources.set(url, state);
    }

    if (state.status === "loading") {
      try {
        const blob = await state.promise;
        const processed = await this.postProcessor.process(blob);
        const readyState: ResourceState<T> = {
          status: "ready",
          blob,
          processed,
        };
        this.resources.set(url, readyState);
        return processed;
      } catch (error) {
        const errorState: ResourceState<T> = {
          status: "error",
          error: error as Error,
        };
        this.resources.set(url, errorState);
        throw error;
      }
    } else if (state.status === "ready") {
      return state.processed;
    } else {
      // Error state - throw stored error
      throw state.error;
    }
  }

  /**
   * Dispose resources that are no longer needed.
   * Internal method - called automatically by resolveResources().
   */
  private pruneUnused(neededUrls: Set<string>): void {
    for (const [url, state] of this.resources.entries()) {
      if (!neededUrls.has(url) && state.status === "ready") {
        this.postProcessor.dispose(state.processed);
        this.resources.delete(url);
      }
    }
  }

  /**
   * Dispose all resources. Call when renderer is destroyed.
   */
  destroy(): void {
    for (const state of this.resources.values()) {
      if (state.status === "ready") {
        this.postProcessor.dispose(state.processed);
      }
    }
    this.resources.clear();
  }
}

/**
 * Extract all resource URLs from a frame by traversing the tree.
 * Returns a Set of unique URLs for Image shapes.
 */
export function extractResourceUrls(frame: Frame): Set<string> {
  const urls = new Set<string>();

  function visit(node: FrameNode): void {
    if (node.type === "image") {
      urls.add(node.url);
    } else if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  visit(frame.root);
  return urls;
}

/**
 * Base class for renderers providing common animation loop functionality.
 *
 * Subclasses must implement the `render(time)` method to draw the frame.
 * The `loop()` and `stop()` methods handle requestAnimationFrame management.
 */
export abstract class BaseRenderer implements Renderer {
  protected generator: Generator;
  private animationId: number | null = null;

  constructor(generator: Generator) {
    this.generator = generator;
  }

  /** Render a single frame. Subclasses implement this. */
  abstract render(time: number): Promise<void>;

  /** Clean up resources. Subclasses implement this. */
  abstract destroy(): void;

  /** Start the animation loop. */
  loop(): void {
    const animate = async (time: number) => {
      await this.render(time);
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  /** Stop the animation loop. */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

/**
 * Result of computing viewport-to-element transform.
 * Apply as: translate(translateX, translateY) then scale(scaleX, -scaleY)
 * The negative scaleY flips Y axis from Y-up (viewport) to Y-down (screen).
 */
export interface ViewportTransformResult {
  /** X translation to center of element */
  translateX: number;
  /** Y translation to center of element */
  translateY: number;
  /** X scale factor */
  scaleX: number;
  /** Y scale factor (apply as -scaleY to flip Y axis) */
  scaleY: number;
}

/**
 * Compute the transform from viewport coordinates to element coordinates.
 *
 * Transforms from:
 * - Origin at center (0,0), Y-up, viewport units
 * To:
 * - Origin at top-left, Y-down, pixel units
 *
 * @param viewport - The viewport configuration from Frame
 * @param elementWidth - Current width of the target element in pixels
 * @param elementHeight - Current height of the target element in pixels
 * @returns Transform parameters to apply to rendering context
 */
export function computeViewportTransform(
  viewport: Viewport,
  elementWidth: number,
  elementHeight: number
): ViewportTransformResult {
  const viewportWidth = viewport.halfWidth * 2;
  const viewportHeight = viewport.halfHeight * 2;

  let scaleX: number;
  let scaleY: number;

  switch (viewport.scaleMode) {
    case "fit": {
      // Uniform scale to fit, letterbox/pillarbox
      const scale = Math.min(
        elementWidth / viewportWidth,
        elementHeight / viewportHeight
      );
      scaleX = scale;
      scaleY = scale;
      break;
    }
    case "fill": {
      // Uniform scale to fill, crop outside
      const scale = Math.max(
        elementWidth / viewportWidth,
        elementHeight / viewportHeight
      );
      scaleX = scale;
      scaleY = scale;
      break;
    }
    case "stretch": {
      // Non-uniform scale to exactly fill
      scaleX = elementWidth / viewportWidth;
      scaleY = elementHeight / viewportHeight;
      break;
    }
  }

  return {
    translateX: elementWidth / 2,
    translateY: elementHeight / 2,
    scaleX,
    scaleY,
  };
}

/**
 * A 2D point represented as a tuple [x, y].
 */
export type Point = [number, number];

/**
 * Transform element coordinates to frame coordinates.
 *
 * This inverts the viewport transform computed by `computeViewportTransform`,
 * converting from:
 * - Origin at top-left, Y-down, pixel units (element/screen space)
 * To:
 * - Origin at center (0,0), Y-up, viewport units (frame space)
 *
 * @param input - Single point [x, y]
 * @param transform - The viewport transform to invert
 * @returns Transformed point in frame coordinates
 */
export function toViewportCoords(
  input: Point,
  transform: ViewportTransformResult
): Point;

/**
 * Transform an array of element coordinates to frame coordinates.
 *
 * @param input - Array of points [[x, y], ...]
 * @param transform - The viewport transform to invert
 * @returns Array of transformed points in frame coordinates
 */
export function toViewportCoords(
  input: Point[],
  transform: ViewportTransformResult
): Point[];

/**
 * Transform a record of element coordinates to frame coordinates.
 *
 * @param input - Record mapping keys to points
 * @param transform - The viewport transform to invert
 * @returns Record with same keys, values transformed to frame coordinates
 */
export function toViewportCoords<K extends string>(
  input: Record<K, Point>,
  transform: ViewportTransformResult
): Record<K, Point>;

/**
 * Transform a map of element coordinates to frame coordinates.
 *
 * @param input - Map from keys to points
 * @param transform - The viewport transform to invert
 * @returns Map with same keys, values transformed to frame coordinates
 */
export function toViewportCoords<K>(
  input: Map<K, Point>,
  transform: ViewportTransformResult
): Map<K, Point>;

/**
 * Transform element coordinates to frame coordinates.
 * Implementation supporting all overloaded signatures.
 */
export function toViewportCoords<K extends string>(
  input: Point | Point[] | Record<K, Point> | Map<unknown, Point>,
  transform: ViewportTransformResult
): Point | Point[] | Record<K, Point> | Map<unknown, Point> {
  // Helper to transform a single point
  const transformPoint = ([elementX, elementY]: Point): Point => {
    const x = (elementX - transform.translateX) / transform.scaleX;
    const y = (elementY - transform.translateY) / -transform.scaleY;
    return [x, y];
  };

  // Single point: [number, number]
  if (
    Array.isArray(input) &&
    input.length === 2 &&
    typeof input[0] === "number" &&
    typeof input[1] === "number"
  ) {
    return transformPoint(input as Point);
  }

  // Array of points: [number, number][]
  if (Array.isArray(input)) {
    return (input as Point[]).map(transformPoint);
  }

  // Map<K, Point>
  if (input instanceof Map) {
    const result = new Map<unknown, Point>();
    for (const [key, point] of input) {
      result.set(key, transformPoint(point));
    }
    return result;
  }

  // Record<string, Point>
  return mapValues(input as Record<K, Point>, transformPoint);
}
