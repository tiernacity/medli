import type { TestScene } from "./types";
import { scene as fullDemo } from "./full-demo";
import { scene as materials } from "./materials";
import { scene as transforms } from "./transforms";
import { scene as imageTransforms } from "./image-transforms";
import { scene as imageCrop } from "./image-crop";
import { scene as optionalClear } from "./optional-clear";
import { scene as transparency } from "./transparency";
import { scene as interaction, setCirclePosition } from "./interaction";
import { scene as stressShapes } from "./stress-shapes";
import { scene as stressBatch } from "./stress-batch";
import { scene as stressAnimation } from "./stress-animation";
import { scene as stressTransforms } from "./stress-transforms";
import { scene as fragmentDemo } from "./fragment-demo";

export const scenes: Record<string, TestScene> = {
  "full-demo": fullDemo,
  materials: materials,
  transforms: transforms,
  "image-transforms": imageTransforms,
  "image-crop": imageCrop,
  "optional-clear": optionalClear,
  transparency: transparency,
  interaction: interaction,
  "stress-shapes": stressShapes,
  "stress-batch": stressBatch,
  "stress-animation": stressAnimation,
  "stress-transforms": stressTransforms,
  "fragment-demo": fragmentDemo,
};

export type SceneId = keyof typeof scenes;
export const defaultSceneId = "full-demo";

export type { TestScene };
export { setCirclePosition };
