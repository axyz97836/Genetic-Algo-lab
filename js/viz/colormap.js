/**
 * js/viz/colormap.js - Colormaps and Legend Utilities for GA Lab.
 * Conforms to SPEC.md §4.3a and UI Redesign (Strict 3-Color Palette).
 *
 * Graphite: #101417 (RGB: 16, 20, 23)
 * Stone:    #D8D4C8 (RGB: 216, 212, 200)
 * Lime:     #C6F135 (RGB: 198, 241, 53)
 */

/**
 * Sequential Monochrome Ramp: Graphite (#101417) -> Stone (#D8D4C8)
 * u in [0, 1]: 0 = Graphite (dark/low), 1 = Stone (bright/high)
 */
export function getSequentialMonochromeRgb(u) {
  const clampedU = Math.max(0, Math.min(1, u));
  // Graphite: (16, 20, 23)
  // Stone:    (216, 212, 200)
  const r = Math.round(16 + clampedU * (216 - 16));
  const g = Math.round(20 + clampedU * (212 - 20));
  const b = Math.round(23 + clampedU * (200 - 23));
  return { r, g, b };
}

export function getSequentialMonochromeColor(u) {
  const { r, g, b } = getSequentialMonochromeRgb(u);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Draws a horizontal sequential colormap gradient (Graphite -> Stone) into a 2D canvas.
 */
export function renderColormapGradient(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let x = 0; x < w; x++) {
    const u = x / Math.max(1, w - 1);
    const { r, g, b } = getSequentialMonochromeRgb(u);

    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
