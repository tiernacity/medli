/**
 * Remote Pendulum
 *
 * Server-generated chaotic double pendulum simulation.
 * Uses RemoteFetchGenerator to poll /frame.json for server-generated frames.
 */
import { RemoteFetchGenerator } from "@medli/generator-remote";
import type { SketchModule, SketchInstance } from "./types";

/**
 * Create a remote pendulum sketch instance.
 * No interactions - the animation is driven by the server.
 */
function create(
  _element: HTMLCanvasElement | SVGSVGElement
): SketchInstance {
  const generator = RemoteFetchGenerator.fromUrl("http://localhost:3001", {
    pollInterval: 10, // Poll frequently for smooth animation
  });

  return {
    generator,
    destroy: () => generator.destroy(),
  };
}

export const remotePendulum: SketchModule = {
  name: "Double Pendulum (Remote)",
  description: "Server-generated chaotic double pendulum simulation",
  create,
};
