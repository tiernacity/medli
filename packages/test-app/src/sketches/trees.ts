/**
 * Trees01
 *
 * Port of https://openprocessing.org/sketch/627398 by Pierre MARZIN
 *
 * Procedural tree generation with branching growth simulation.
 * Trees grow from the bottom, branches divide probabilistically,
 * and shadows are rendered with low-alpha strokes.
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import type { SketchModule, SketchInstance } from "./types";

// ============================================================================
// Utility functions
// ============================================================================

/** Linear interpolation: map value from [inMin, inMax] to [outMin, outMax] */
function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Random number in range [min, max] */
function random(min: number, max?: number): number {
  if (max === undefined) {
    return Math.random() * min;
  }
  return min + Math.random() * (max - min);
}

/** Convert HSB (0-360, 0-255, 0-255) to CSS hsla() string */
function hsba(h: number, s: number, b: number, a: number): string {
  // Normalize S and B from 0-255 to 0-1
  const sNorm = s / 255;
  const bNorm = b / 255;

  // Convert HSB to HSL
  // L = V * (1 - S/2)
  const l = bNorm * (1 - sNorm / 2);

  // S_HSL = 0 if L = 0 or L = 1, otherwise (V - L) / min(L, 1 - L)
  let sHsl = 0;
  if (l > 0 && l < 1) {
    sHsl = (bNorm - l) / Math.min(l, 1 - l);
  }

  // Convert to percentages for CSS
  const lPercent = Math.round(l * 100);
  const sPercent = Math.round(sHsl * 100);

  // Clamp hue to 0-360
  const hClamped = ((h % 360) + 360) % 360;

  return `hsla(${Math.round(hClamped)}, ${sPercent}%, ${lPercent}%, ${a})`;
}

// ============================================================================
// Vector helper
// ============================================================================

interface Vector {
  x: number;
  y: number;
}

function createVector(x: number, y: number): Vector {
  return { x, y };
}

function copyVector(v: Vector): Vector {
  return { x: v.x, y: v.y };
}

// ============================================================================
// Tree and Branch classes
// ============================================================================

interface Branch {
  position: Vector;
  stw: number; // stroke width
  gen: number; // generation index
  alive: boolean;
  age: number;
  angle: number;
  speed: Vector;
  index: number; // tree index
  maxlife: number;
  proba1: number;
  proba2: number;
  proba3: number;
  proba4: number;
  deviation: number;
}

interface Tree {
  branches: Branch[];
  start: Vector;
  coeff: number;
  teinte: number; // base hue
  index: number;
  proba1: number;
  proba2: number;
  proba3: number;
  proba4: number;
}

// ============================================================================
// State management
// ============================================================================

interface TreesState {
  trees: Tree[];
  width: number;
  height: number;
  maxlife: number;
  initialized: boolean;
  needsClear: boolean;
}

/** Background color matching the original sketch */
const BACKGROUND_COLOR = "hsl(40, 4%, 100%)";

function createInitialState(): TreesState {
  return {
    trees: [],
    width: 0,
    height: 0,
    maxlife: 15,
    initialized: false,
    needsClear: true,
  };
}

function createTree(
  state: TreesState,
  i: number,
  j: number,
  nh: number,
  nv: number
): Tree {
  const { width, height, maxlife } = state;

  // Origin location - convert from Processing coords (Y-down, origin top-left)
  // to medli coords (Y-up, origin center)
  const procX = 0.1 * width + i * Math.floor((0.9 * width) / nh);
  const procY = Math.floor(0.2 * height + j * Math.floor((0.8 * height) / nv));

  // Convert to medli viewport coords
  const x = procX - width / 2;
  const y = height / 2 - procY; // flip Y

  const start = createVector(x, y);

  const tree: Tree = {
    branches: [],
    start,
    coeff: (height / 2 - y) / (height - 130), // Adjusted for Y-up
    teinte: random(30),
    index: i + j * nh,
    proba1: random(0.8, 1),
    proba2: random(0.8, 1),
    proba3: random(0.4, 0.5),
    proba4: random(0.4, 0.5),
  };

  // Create first branch (trunk)
  const stw = 15 * Math.sqrt((height / 2 - y) / height);
  tree.branches.push(createBranch(tree, start, stw, 0, 1, maxlife));

  return tree;
}

function createBranch(
  tree: Tree,
  start: Vector,
  stw: number,
  angle: number,
  gen: number,
  maxlife: number
): Branch {
  return {
    position: copyVector(start),
    stw,
    gen,
    alive: true,
    age: 0,
    angle,
    speed: createVector(0, 3), // Y is positive (up) in medli
    index: tree.index,
    maxlife: maxlife * random(0.3, 0.8),
    proba1: tree.proba1,
    proba2: tree.proba2,
    proba3: tree.proba3,
    proba4: tree.proba4,
    deviation: random(0.2, 0.7),
  };
}

function initializeTrees(state: TreesState, width: number, height: number) {
  state.width = width;
  state.height = height;
  state.trees = [];

  const nh = 8; // columns
  const nv = 3; // rows

  for (let i = 0; i < nh; i++) {
    for (let j = 0; j < nv; j++) {
      state.trees.push(createTree(state, i, j, nh, nv));
    }
  }

  state.initialized = true;
}

// ============================================================================
// Generator factory
// ============================================================================

/**
 * Create a trees sketch instance with interaction handling.
 * Click to reset tree growth.
 */
function create(element: HTMLCanvasElement | SVGSVGElement): SketchInstance {
  const state = createInitialState();

  function reset() {
    state.initialized = false;
    state.needsClear = true;
  }

  const generator = new ProceduralGenerator((p) => {
    const width = p.targetWidth;
    const height = p.targetHeight;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Initialize or reinitialize if needed
    if (
      !state.initialized ||
      state.width !== width ||
      state.height !== height
    ) {
      initializeTrees(state, width, height);
    }

    // Set viewport to match canvas buffer dimensions
    p.viewport(halfWidth, halfHeight);

    // Clear on first frame or after reset, then accumulate.
    // When background() is not called, shapes draw on top of previous frames.
    if (state.needsClear) {
      p.background(BACKGROUND_COLOR);
      state.needsClear = false;
    }

    // Grow and render all trees
    for (const tree of state.trees) {
      for (let i = 0; i < tree.branches.length; i++) {
        const branch = tree.branches[i];
        if (!branch.alive) continue;

        // Age the branch
        branch.age++;

        // Grow the branch
        growBranch(state, tree, branch);

        // Display the branch
        displayBranch(p, tree, branch);
      }
    }
  });

  // Set up click-to-reset interaction
  function onClick() {
    reset();
  }

  element.addEventListener("click", onClick);

  function destroy() {
    element.removeEventListener("click", onClick);
  }

  return { generator, destroy };
}

export const trees: SketchModule = {
  name: "Trees",
  description: "Procedural tree generation with branching and shadows",
  create,
};

function growBranch(state: TreesState, tree: Tree, branch: Branch) {
  // Branch has reached its max age (or random decides it dies sooner)
  if (
    branch.age === Math.floor(branch.maxlife / branch.gen) ||
    random(1) < 0.05 * branch.gen
  ) {
    // Branch is dead
    branch.alive = false;

    // If this branch is big enough, it divides itself
    if (branch.stw > 0.2) {
      // Divisions depend on the tree probabilities
      if (random(1) < branch.proba1 / branch.gen) {
        tree.branches.push(
          createBranch(
            tree,
            copyVector(branch.position),
            branch.stw * random(0.2, 1),
            branch.angle + random(0.7, 1.1) * branch.deviation,
            branch.gen + 0.1,
            state.maxlife
          )
        );
      }
      if (random(1) < branch.proba2 / branch.gen) {
        tree.branches.push(
          createBranch(
            tree,
            copyVector(branch.position),
            branch.stw * random(0.2, 1),
            branch.angle - random(0.7, 1.1) * branch.deviation,
            branch.gen + 0.1,
            state.maxlife
          )
        );
      }
      if (random(1) < branch.proba3 / branch.gen) {
        tree.branches.push(
          createBranch(
            tree,
            copyVector(branch.position),
            branch.stw * random(0.5, 0.8),
            branch.angle + random(0.2, 1) * branch.deviation,
            branch.gen + 0.1,
            state.maxlife
          )
        );
      }
      if (random(1) < branch.proba4 / branch.gen) {
        tree.branches.push(
          createBranch(
            tree,
            copyVector(branch.position),
            branch.stw * random(0.5, 0.8),
            branch.angle - random(0.2, 1) * branch.deviation,
            branch.gen + 0.1,
            state.maxlife
          )
        );
      }
    }
  } else {
    // Branch is still alive, it grows (add random wiggle)
    branch.speed.x += random(-0.5, 0.5);
  }
}

function displayBranch(
  p: Parameters<ConstructorParameters<typeof ProceduralGenerator>[0]>[0],
  tree: Tree,
  branch: Branch
) {
  const c = tree.coeff;
  const st = tree.start;
  const x0 = branch.position.x;
  const y0 = branch.position.y;

  // Rotation of the branch segment around its origin
  // Standard 2D rotation with Y-up: positive angle rotates counterclockwise
  branch.position.x +=
    -branch.speed.x * Math.cos(branch.angle) +
    branch.speed.y * Math.sin(branch.angle);
  branch.position.y +=
    branch.speed.x * Math.sin(branch.angle) +
    branch.speed.y * Math.cos(branch.angle);

  // Calculate shadow displacement
  // In the original: dis = .005 * pow(st.y - y0, 1.8)
  // st.y is the tree origin Y, y0 is current position Y
  // In Y-up coords, higher branches have higher Y, so we use (y0 - st.y) for distance from root
  const heightFromRoot = y0 - st.y;
  const dis = 0.005 * Math.pow(Math.abs(heightFromRoot), 1.8);

  // Shadow Y position: in original it's 2*st.y - y0 (reflection below)
  // In Y-up coords, reflection below means: st.y - (y0 - st.y) = 2*st.y - y0
  const shadowY0 = 2 * st.y - y0;
  const shadowY1 = 2 * st.y - branch.position.y;

  // Shadows (very low alpha black)
  p.stroke(hsba(tree.teinte + branch.age + 10 * branch.gen, 0, 0, 0.04));
  p.strokeWidth(
    map(branch.age, 0, branch.maxlife, branch.stw * 1.3, branch.stw * 0.9)
  );

  // Draw shadow lines (twice for density, with random displacement)
  p.line(
    x0 + dis * random(0.5, 1.2),
    shadowY0 - dis * random(0.5, 1.2),
    branch.position.x + dis * random(0.5, 1.2),
    shadowY1 - dis * random(0.5, 1.2)
  );
  p.line(
    x0 + dis * random(0.5, 1.2),
    shadowY0 - dis * random(0.5, 1.2),
    branch.position.x + dis * random(0.5, 1.2),
    shadowY1 - dis * random(0.5, 1.2)
  );

  // Light accent
  p.strokeWidth(
    map(branch.age, 0, branch.maxlife, branch.stw, branch.stw * 0.6)
  );
  p.stroke(
    hsba(
      tree.teinte + branch.age + 20 * branch.gen,
      150 * c,
      200 + 20 * branch.gen,
      15 * c
    )
  );
  p.line(
    x0 + 0.1 * branch.stw,
    y0,
    branch.position.x + 0.1 * branch.stw,
    branch.position.y
  );

  // Darker tree (main branch line)
  p.stroke(
    hsba(
      tree.teinte + branch.age + 20 * branch.gen,
      100 * c,
      50 + 20 * branch.gen,
      15 * c
    )
  );
  p.strokeWidth(
    map(branch.age, 0, branch.maxlife, branch.stw, branch.stw * 0.6)
  );
  p.line(x0, y0, branch.position.x, branch.position.y);
}
