import type { Frame, Generator } from "@medli/spec";

export interface ObjectDefinition {
  backgroundColor: string;
}

export class ObjectGenerator implements Generator {
  private definition: ObjectDefinition;

  constructor(definition: ObjectDefinition) {
    this.definition = definition;
  }

  frame(_time: number = 0): Frame {
    return {
      backgroundColor: this.definition.backgroundColor,
    };
  }
}
