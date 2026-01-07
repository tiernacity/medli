import type { Frame, Generator } from "@medli/spec";

export interface ProceduralConfig {
  backgroundColor?: string;
}

export class ProceduralGenerator implements Generator {
  private config: ProceduralConfig;

  constructor(config: ProceduralConfig = {}) {
    this.config = config;
  }

  frame(_time: number = 0): Frame {
    return {
      backgroundColor: this.config.backgroundColor ?? "#000000",
    };
  }
}
