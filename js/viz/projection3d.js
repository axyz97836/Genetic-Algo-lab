/**
 * js/viz/projection3d.js - Pure 3D Perspective Projection & Sorting Helpers.
 * Zero external dependencies. Fully testable in Node and Browser environments.
 */

/**
 * Projects a 3D coordinate (worldX, worldY, worldZ) onto a 2D screen coordinate (screenX, screenY, depth).
 * Camera model: Orbiting camera looking at the origin (0, 0, 0).
 *
 * @param {number} x - 3D X coordinate
 * @param {number} y - 3D Y coordinate (height / elevation)
 * @param {number} z - 3D Z coordinate
 * @param {number} yaw - Azimuth rotation angle in radians (about Y axis)
 * @param {number} pitch - Elevation angle in radians (about X axis)
 * @param {number} distance - Distance from camera to origin
 * @param {number} fov - Field of view scale factor
 * @param {number} screenWidth - Canvas display width
 * @param {number} screenHeight - Canvas display height
 * @returns {{ x: number, y: number, depth: number, visible: boolean }}
 */
export function project3DTo2D(x, y, z, yaw, pitch, distance, fov, screenWidth, screenHeight) {
  // 1. Rotate around Y axis (Yaw)
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x1 = x * cosYaw - z * sinYaw;
  const z1 = x * sinYaw + z * cosYaw;
  const y1 = y;

  // 2. Rotate around X axis (Pitch)
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const y2 = y1 * cosPitch - z1 * sinPitch;
  const z2 = y1 * sinPitch + z1 * cosPitch;
  const x2 = x1;

  // 3. Translate along Z by camera distance
  const camZ = z2 + distance;

  // Near-plane clipping guard
  if (camZ <= 0.1) {
    return { x: 0, y: 0, depth: -1, visible: false };
  }

  // 4. Perspective division
  const scale = fov / camZ;
  const screenX = screenWidth * 0.5 + x2 * scale;
  const screenY = screenHeight * 0.5 - y2 * scale; // Invert Y for screen coords

  return {
    x: screenX,
    y: screenY,
    depth: camZ,
    visible: true
  };
}

/**
 * Calculates the centroid depth of a 3D bounding box for Painter's Algorithm sorting.
 *
 * @param {number} cx - Center X
 * @param {number} cy - Center Y (height)
 * @param {number} cz - Center Z
 * @param {number} yaw - Camera yaw in radians
 * @param {number} pitch - Camera pitch in radians
 * @param {number} distance - Camera distance
 * @returns {number} Camera-space Z depth (larger = further from camera)
 */
export function calculateBarDepth(cx, cy, cz, yaw, pitch, distance) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const z1 = cx * sinYaw + cz * cosYaw;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const z2 = cy * sinPitch + z1 * cosPitch;

  return z2 + distance;
}

/**
 * Sorts bar items in-place from furthest to nearest (descending depth) for painter's algorithm.
 *
 * @param {Array<{ depth: number }>} items - List of items with depth property
 */
export function sortFarToNear(items) {
  items.sort((a, b) => b.depth - a.depth);
}

/**
 * Downsamples a 2D scalar grid if dimension exceeds maxGridSize.
 *
 * @param {number[][]} grid - 2D square matrix of values
 * @param {number} maxGridSize - Maximum allowed width/height
 * @returns {{ data: number[][], size: number, factor: number }}
 */
export function downsampleGrid(grid, maxGridSize = 32) {
  const size = grid.length;
  if (size <= maxGridSize) {
    return { data: grid, size, factor: 1 };
  }

  const factor = Math.ceil(size / maxGridSize);
  const newSize = Math.floor(size / factor);
  const newGrid = [];

  for (let i = 0; i < newSize; i++) {
    newGrid[i] = [];
    for (let j = 0; j < newSize; j++) {
      let sum = 0;
      let count = 0;
      for (let di = 0; di < factor; di++) {
        for (let dj = 0; dj < factor; dj++) {
          const r = i * factor + di;
          const c = j * factor + dj;
          if (r < size && c < size) {
            sum += grid[r][c];
            count++;
          }
        }
      }
      newGrid[i][j] = count > 0 ? sum / count : 0;
    }
  }

  return { data: newGrid, size: newSize, factor };
}
