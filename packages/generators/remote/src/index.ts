import type { Frame, Generator, RenderContext } from "@medli/spec";

/**
 * Options for creating a RemoteFetchGenerator.
 */
export interface RemoteFetchGeneratorOptions {
  /**
   * How often to fetch new frames (in milliseconds).
   * Default: 1000ms
   */
  pollInterval?: number;

  /**
   * Custom fetch implementation.
   * Allows injecting authentication, custom headers, etc.
   * Defaults to globalThis.fetch.
   */
  fetch?: typeof fetch;
}

/**
 * Empty frame returned before first successful fetch.
 */
function emptyFrame(): Frame {
  return {
    viewport: {
      halfWidth: 50,
      halfHeight: 50,
      scaleMode: "fit",
    },
    background: "#000000",
    root: {
      type: "material",
      id: "root",
      fill: "#000000",
      stroke: "#000000",
      strokeWidth: 1,
      children: [],
    },
  };
}

/**
 * Generator that fetches Frame data from a remote URL.
 *
 * Polls the URL at a configurable interval and caches the most recent frame.
 * The frame() method returns the cached frame immediately (context parameter ignored).
 * Before the first successful fetch, returns an empty frame.
 *
 * IMPORTANT: Call destroy() when done to clean up the polling timer.
 *
 * Usage:
 *   const generator = RemoteFetchGenerator.fromUrl('/frame.json', {
 *     pollInterval: 1000,
 *     fetch: customFetch, // optional
 *   });
 *
 *   // Later...
 *   const frame = generator.frame({ time: Date.now(), targetDimensions: [800, 600] });
 *
 *   // When done:
 *   generator.destroy();
 */
export class RemoteFetchGenerator implements Generator {
  private url: string;
  private pollInterval: number;
  private fetchFn: typeof fetch;
  private cachedFrame: Frame;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private targetDimensions: [number, number] | null = null;

  private constructor(url: string, options: RemoteFetchGeneratorOptions = {}) {
    this.url = url;
    this.pollInterval = options.pollInterval ?? 1000;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.cachedFrame = emptyFrame();

    // Start polling immediately
    this.poll();
  }

  /**
   * Create a RemoteFetchGenerator for the given URL.
   *
   * @param url - URL to fetch Frame JSON from
   * @param options - Configuration options
   */
  static fromUrl(
    url: string,
    options: RemoteFetchGeneratorOptions = {}
  ): RemoteFetchGenerator {
    return new RemoteFetchGenerator(url, options);
  }

  /**
   * Returns the most recently fetched frame.
   * Updates stored targetDimensions for future polls.
   * Before first successful fetch, returns an empty frame.
   */
  frame(context: RenderContext): Frame {
    this.targetDimensions = context.targetDimensions;
    return this.cachedFrame;
  }

  /**
   * Stop polling and clean up resources.
   * Must be called when the generator is no longer needed.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Build the fetch URL with optional targetDimensions query params.
   */
  private buildUrl(): string {
    if (!this.targetDimensions) {
      return this.url;
    }

    const [width, height] = this.targetDimensions;
    const url = new URL(
      this.url,
      globalThis.location?.href ?? "http://localhost"
    );
    url.searchParams.set("targetWidth", String(width));
    url.searchParams.set("targetHeight", String(height));
    return url.toString();
  }

  /**
   * Internal: fetch frame and schedule next poll.
   */
  private async poll(): Promise<void> {
    if (this.destroyed) return;

    try {
      const fetchUrl = this.buildUrl();
      const response = await this.fetchFn(fetchUrl);
      if (response.ok) {
        const json = await response.json();
        this.cachedFrame = json as Frame;
      }
    } catch {
      // Silently ignore fetch errors - keep using cached frame
    }

    // Schedule next poll (using setTimeout for more predictable behavior)
    if (!this.destroyed) {
      this.timeoutId = setTimeout(() => this.poll(), this.pollInterval);
    }
  }
}
