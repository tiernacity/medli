import type { Generator, Shape } from "@medli/spec";

export interface ProceduralConfig {
  seed?: number;
  count: number;
}

export class ProceduralGenerator implements Generator {
  private config: ProceduralConfig;

  constructor(config: ProceduralConfig) {
    this.config = config;
  }

  generate(): Shape[] {
    const shapes: Shape[] = [];
    for (let i = 0; i < this.config.count; i++) {
      shapes.push({
        type: "point",
        x: i,
        y: i,
      });
    }
    return shapes;
  }
}
