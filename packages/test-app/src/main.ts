import { ProceduralGenerator } from "@medli/generator-procedural";
import { ObjectGenerator } from "@medli/generator-object";
import { SvgRenderer } from "@medli/renderer-svg";
import { CanvasRenderer } from "@medli/renderer-canvas";

const colorInput = document.getElementById("bg-color") as HTMLInputElement;
const colorValue = document.getElementById("color-value") as HTMLSpanElement;

const procSvg = document.getElementById("proc-svg") as SVGSVGElement;
const procCanvas = document.getElementById("proc-canvas") as HTMLCanvasElement;
const objSvg = document.getElementById("obj-svg") as SVGSVGElement;
const objCanvas = document.getElementById("obj-canvas") as HTMLCanvasElement;

function renderAll(backgroundColor: string): void {
  // Create generators with the current background color
  const proceduralGen = new ProceduralGenerator({ backgroundColor });
  const objectGen = new ObjectGenerator({ backgroundColor });

  // Create and render each combination
  const procSvgRenderer = new SvgRenderer(procSvg, proceduralGen);
  const procCanvasRenderer = new CanvasRenderer(procCanvas, proceduralGen);
  const objSvgRenderer = new SvgRenderer(objSvg, objectGen);
  const objCanvasRenderer = new CanvasRenderer(objCanvas, objectGen);

  procSvgRenderer.render(0);
  procCanvasRenderer.render(0);
  objSvgRenderer.render(0);
  objCanvasRenderer.render(0);
}

// Initial render
renderAll(colorInput.value);

// Update on color change
colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorValue.textContent = color;
  renderAll(color);
});
