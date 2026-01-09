import type { TestScene } from "./types";
import { scene as fullDemo } from "./full-demo";
import { scene as materials } from "./materials";
import { scene as transforms } from "./transforms";
import { scene as imageTransforms } from "./image-transforms";
import { scene as imageCrop } from "./image-crop";
import { scene as optionalClear } from "./optional-clear";
import { scene as transparency } from "./transparency";

export const scenes: Record<string, TestScene> = {
  "full-demo": fullDemo,
  materials: materials,
  transforms: transforms,
  "image-transforms": imageTransforms,
  "image-crop": imageCrop,
  "optional-clear": optionalClear,
  transparency: transparency,
};

export type SceneId = keyof typeof scenes;
export const defaultSceneId = "full-demo";

export type { TestScene };
