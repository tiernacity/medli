import type { Generator, Shape } from "@medli/spec";

export interface ObjectDefinition {
  shapes: Shape[];
}

export class ObjectGenerator implements Generator {
  private definition: ObjectDefinition;

  constructor(definition: ObjectDefinition) {
    this.definition = definition;
  }

  generate(): Shape[] {
    return [...this.definition.shapes];
  }
}
