/**
 * js/ui/tilt.js - Depth-Layered 3D Perspective & Pointer Tilt Controller.
 * Conforms to GA Lab UI Redesign Specification:
 * - Container perspective (700-900px, nominal 800px)
 * - Pointer tilt with lerp smoothing factor ~0.08, clamped to ±6°
 * - Touch idle sway (sinusoidal, ±3°, period 8-12s)
 * - Strict prefers-reduced-motion compliance
 * - Pure vanilla ES module, zero external dependencies, read-only UI observer
 */

export class TiltController {
  /**
   * @param {HTMLElement} rootElement - The #app-root container element
   */
  constructor(rootElement) {
    this.root = rootElement || document.getElementById('app-root') || document.documentElement;
    this.rotX = 0;
    this.rotY = 0;
    this.targetRotX = 0;
    this.targetRotY = 0;
    this.lerpFactor = 0.08;
    this.maxTilt = 6.0; // ±6 degrees
    this.swayMax = 3.0; // ±3 degrees
    this.swayPeriod = 10.0; // 10 seconds

    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.lastPointerTime = 0;
    this.pointerActive = false;
    this.reducedMotion = false;
    this.rafId = null;

    this.init();
  }

  init() {
    // Check prefers-reduced-motion
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mql.matches;
    mql.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      if (this.reducedMotion) {
        this.reset();
      } else {
        this.start();
      }
    });

    if (this.reducedMotion) {
      this.reset();
      return;
    }

    // Attach pointer listeners
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
    window.addEventListener('pointerleave', () => this.onPointerLeave(), { passive: true });
    window.addEventListener('touchstart', () => {
      this.isTouch = true;
      this.pointerActive = false;
    }, { passive: true });

    this.start();
  }

  onPointerMove(e) {
    if (this.reducedMotion) return;
    this.pointerActive = true;
    this.lastPointerTime = performance.now();

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    // Normalized coordinates from -1 to 1 (center is 0)
    const nx = (e.clientX / w) * 2 - 1;
    const ny = (e.clientY / h) * 2 - 1;

    // Pitch (rotX): mouse down tilts top backward (negative rotX)
    // Yaw (rotY): mouse right tilts right backward (positive rotY)
    this.targetRotX = Math.max(-this.maxTilt, Math.min(this.maxTilt, -ny * this.maxTilt));
    this.targetRotY = Math.max(-this.maxTilt, Math.min(this.maxTilt, nx * this.maxTilt));
  }

  onPointerLeave() {
    this.pointerActive = false;
    this.targetRotX = 0;
    this.targetRotY = 0;
  }

  start() {
    if (this.rafId) return;
    const update = (time) => {
      this.update(time);
      this.rafId = requestAnimationFrame(update);
    };
    this.rafId = requestAnimationFrame(update);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset() {
    this.stop();
    this.rotX = 0;
    this.rotY = 0;
    this.targetRotX = 0;
    this.targetRotY = 0;
    if (this.root) {
      this.root.style.setProperty('--tilt-rx', '0deg');
      this.root.style.setProperty('--tilt-ry', '0deg');
    }
  }

  update(timestamp) {
    if (this.reducedMotion) return;

    const now = performance.now();
    const idleTime = now - this.lastPointerTime;

    // On touch devices or when pointer has been idle for > 2.5s, blend into sinusoidal idle sway
    if (this.isTouch || idleTime > 2500) {
      const t = now * 0.001; // seconds
      const omega = (2 * Math.PI) / this.swayPeriod;
      const swayX = Math.sin(t * omega) * this.swayMax;
      const swayY = Math.cos(t * omega * 0.8) * this.swayMax;

      if (idleTime > 4000 || this.isTouch) {
        this.targetRotX = swayX;
        this.targetRotY = swayY;
      } else {
        // Smooth transition into sway
        const blend = (idleTime - 2500) / 1500;
        this.targetRotX = this.targetRotX * (1 - blend) + swayX * blend;
        this.targetRotY = this.targetRotY * (1 - blend) + swayY * blend;
      }
    }

    // Smooth lerp (factor ~0.08)
    this.rotX += (this.targetRotX - this.rotX) * this.lerpFactor;
    this.rotY += (this.targetRotY - this.rotY) * this.lerpFactor;

    // Apply rotation custom properties to root container
    if (this.root) {
      this.root.style.setProperty('--tilt-rx', `${this.rotX.toFixed(3)}deg`);
      this.root.style.setProperty('--tilt-ry', `${this.rotY.toFixed(3)}deg`);
    }
  }
}
