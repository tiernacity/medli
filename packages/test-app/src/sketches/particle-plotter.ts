/**
 * Particle Plotter
 *
 * Port of https://openprocessing.org/sketch/751983 by Vamoss
 *
 * Particles spawn at mouse position and flow according to mathematical
 * slope functions. The sketch doesn't clear the canvas, instead drawing
 * a semi-transparent overlay each frame to create fading trails.
 */
import { ProceduralGenerator } from "@medli/generator-procedural";

// Color palette (from original sketch)
const COLORS = ["#581845", "#900C3F", "#C70039", "#FF5733", "#FFC30F"];

// Particle interface
interface Particle {
  x: number; // Normalized X coordinate (for slope calculations)
  y: number; // Normalized Y coordinate (for slope calculations)
  size: number; // Stroke width
  lastX: number; // Last viewport X
  lastY: number; // Last viewport Y
  color: string; // Color from palette
  direction: number; // Movement direction multiplier
}

// Auto-change variation timer
const CHANGE_DURATION = 3000; // ms

/**
 * Create a particle plotter generator with mouse state control.
 *
 * @param getCanvasSize - Function returning current canvas buffer dimensions
 */
export function createParticlePlotter(
  getCanvasSize: () => { width: number; height: number }
) {
  // State
  const particles: Particle[] = [];
  let variation = 0;
  let lastChangeTime = 0;
  let lastFrameTime = 0;

  // Mouse state (controlled externally)
  let mouseIsPressed = false;
  let mouseX = 0;
  let mouseY = 0;

  /**
   * Set mouse state from external input handler.
   */
  function setMouseState(pressed: boolean, x: number, y: number) {
    mouseIsPressed = pressed;
    mouseX = x;
    mouseY = y;
  }

  // Coordinate conversion helpers
  // These convert between viewport coords (centered, Y-up) and normalized coords (for slopes)
  function getXScale(width: number): number {
    return width / 20;
  }

  function getYScale(width: number, height: number): number {
    return (height / 20) * (width / height);
  }

  // Convert viewport X to normalized X
  function getXNorm(viewportX: number, width: number): number {
    return viewportX / getXScale(width);
  }

  // Convert viewport Y to normalized Y
  function getYNorm(viewportY: number, width: number, height: number): number {
    return viewportY / getYScale(width, height);
  }

  // Convert normalized X to viewport X
  function getXViewport(normX: number, width: number): number {
    return getXScale(width) * normX;
  }

  // Convert normalized Y to viewport Y
  function getYViewport(normY: number, width: number, height: number): number {
    return getYScale(width, height) * normY;
  }

  // Slope functions - determine particle movement direction
  function getSlopeY(x: number, y: number): number {
    switch (variation) {
      case 0:
        return Math.sin(x);
      case 1:
        return Math.sin(x * 5) * y * 0.3;
      case 2:
        return Math.cos(x * y);
      case 3:
        return Math.sin(x) * Math.cos(y);
      case 4:
        return Math.cos(x) * y * y;
      case 5:
        return Math.log(Math.abs(x) + 0.001) * Math.log(Math.abs(y) + 0.001);
      case 6:
        return Math.tan(x) * Math.cos(y);
      case 7:
        return -Math.sin(x * 0.1) * 3; // orbit
      case 8:
        return (x - x * x * x) * 0.01; // two orbits
      case 9:
        return -Math.sin(x);
      case 10:
        return -y - Math.sin(1.5 * x) + 0.7;
      case 11:
        return Math.sin(x) * Math.cos(y);
      default:
        return 0;
    }
  }

  function getSlopeX(x: number, y: number): number {
    switch (variation) {
      case 0:
        return Math.cos(y);
      case 1:
        return Math.cos(y * 5) * x * 0.3;
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        return 1;
      case 7:
        return Math.sin(y * 0.1) * 3; // orbit
      case 8:
        return y / 3; // two orbits
      case 9:
        return -y;
      case 10:
        return -1.5 * y;
      case 11:
        return Math.sin(y) * Math.cos(x);
      default:
        return 0;
    }
  }

  // Random number in range
  function random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  // Random color from palette
  function randomColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  const generator = new ProceduralGenerator((p) => {
    const { width, height } = getCanvasSize();
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Set viewport to match canvas buffer dimensions
    // Origin at center, Y-up coordinate system
    p.viewport(halfWidth, halfHeight);

    // Shapes accumulate on top of previous frames (no background() call).
    // This creates the trail effect as particles move.

    // Calculate deltaTime for physics
    const currentTime = p.time;
    const deltaTime = lastFrameTime > 0 ? currentTime - lastFrameTime : 16;
    lastFrameTime = currentTime;

    // Auto-change variation every CHANGE_DURATION ms
    if (currentTime - lastChangeTime > CHANGE_DURATION) {
      lastChangeTime = currentTime;
      variation = (variation + 1) % 12;
    }

    // Spawn new particles if mouse is pressed
    if (mouseIsPressed) {
      for (let i = 0; i < 20; i++) {
        // Mouse position is in canvas buffer coords (0,0 at top-left)
        // Convert to viewport coords (center at origin, Y-up)
        const screenX = mouseX + random(-100, 100);
        const screenY = mouseY + random(-100, 100);

        // Convert screen coords to viewport coords
        // Screen: (0,0) at top-left, Y-down
        // Viewport: (0,0) at center, Y-up
        const viewportX = screenX - halfWidth;
        const viewportY = halfHeight - screenY; // Flip Y

        const particle: Particle = {
          x: getXNorm(viewportX, width),
          y: getYNorm(viewportY, width, height),
          size: random(1, 5),
          lastX: viewportX,
          lastY: viewportY,
          color: randomColor(),
          direction: random(0.1, 1) * (Math.random() > 0.5 ? 1 : -1),
        };
        particles.push(particle);
      }
    }

    // Draw semi-transparent overlay to create fading trail effect
    // rgba(26, 6, 51, 10/255) ≈ rgba(26, 6, 51, 0.04)
    p.fill("rgba(26, 6, 51, 0.04)");
    p.stroke("rgba(26, 6, 51, 0.04)");
    p.strokeWidth(0);
    p.rectangle(0, 0, width, height);

    // Physics step size
    const stepsize = deltaTime * 0.002;

    // Update and draw particles (iterate backwards for safe removal)
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];

      // Calculate slope at current position
      const slopeX = getSlopeX(particle.x, particle.y);
      const slopeY = getSlopeY(particle.x, particle.y);

      // Update normalized position
      particle.x += particle.direction * slopeX * stepsize;
      particle.y += particle.direction * slopeY * stepsize;

      // Convert to viewport coordinates
      const viewportX = getXViewport(particle.x, width);
      const viewportY = getYViewport(particle.y, width, height);

      // Draw line from last position to current position
      p.stroke(particle.color);
      p.strokeWidth(particle.size);
      p.line(viewportX, viewportY, particle.lastX, particle.lastY);

      // Update last position
      particle.lastX = viewportX;
      particle.lastY = viewportY;

      // Remove particles that go off screen (with border margin)
      const border = 200;
      // Convert viewport coords back to screen coords for bounds check
      const screenX = viewportX + halfWidth;
      const screenY = halfHeight - viewportY;
      if (
        screenX < -border ||
        screenY < -border ||
        screenX > width + border ||
        screenY > height + border
      ) {
        particles.splice(i, 1);
      }
    }
  });

  return { generator, setMouseState };
}
