import type { TestScene } from "./types";
import { scene as fullDemo } from "./full-demo";
import { scene as imageTransforms } from "./image-transforms";

export const scenes: Record<string, TestScene> = {
  "full-demo": fullDemo,
  "image-transforms": imageTransforms,
};

export type SceneId = keyof typeof scenes;
export const defaultSceneId = "full-demo";

export type { TestScene };
