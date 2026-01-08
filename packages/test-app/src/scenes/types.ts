import type { Generator } from "@medli/spec";

export interface TestScene {
  name: string;
  description: string;
  procedural: Generator;
  object: Generator;
  setBackground: (color: string) => void;
}
