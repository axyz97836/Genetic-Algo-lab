/**
 * js/ui/chromosome-3d-helpers.js
 * Pure helper functions for 3D chromosome rendering, crossover geometry, mutation diffs,
 * and accessibility announcements.
 */

/**
 * Splits a chromosome string into two segments for x1 and x2.
 * @param {string} chrom - e.g. "00101000"
 * @param {number} n - bits per variable (default 4)
 * @returns {{ seg1: string, seg2: string, len: number }}
 */
export function splitChromosomeSegments(chrom, n = 4) {
  const s = String(chrom || '');
  return {
    seg1: s.slice(0, n),
    seg2: s.slice(n, 2 * n),
    len: s.length
  };
}

/**
 * Calculates exact horizontal pixel offset for a cut line at cutPoint k.
 * @param {number} cutPoint - 1-based bit position (1..L-1)
 * @param {number} bitWidth - width of each bit block + margins (e.g. 34px)
 * @param {number} gapWidth - width of segment divider gap (e.g. 14px)
 * @param {number} n - segment length (e.g. 4)
 * @returns {number} pixel offset from left
 */
export function computeCrossoverCutOffset(cutPoint, bitWidth = 34, gapWidth = 14, n = 4) {
  if (!cutPoint || cutPoint <= 0) return 0;
  const bitBlocksWidth = cutPoint * bitWidth;
  const gapOffset = cutPoint >= n ? gapWidth : 0;
  return bitBlocksWidth + gapOffset;
}

/**
 * Computes crossover tail swap products.
 * @param {string} p1 - Parent 1 chromosome
 * @param {string} p2 - Parent 2 chromosome
 * @param {number} k - Cut point (1..L-1)
 * @returns {{ child1: string, child2: string, tail1: string, tail2: string }}
 */
export function getCrossoverTails(p1, p2, k) {
  const pref1 = p1.slice(0, k);
  const tail1 = p1.slice(k);
  const pref2 = p2.slice(0, k);
  const tail2 = p2.slice(k);
  return {
    child1: pref1 + tail2,
    child2: pref2 + tail1,
    tail1,
    tail2
  };
}

/**
 * Detects flipped bit positions between original and mutated chromosomes.
 * @param {string} original
 * @param {string} mutated
 * @returns {Array<{ position: number, from: string, to: string }>} 1-based positions
 */
export function detectFlippedBits(original, mutated) {
  const flips = [];
  const len = Math.max(original.length, mutated.length);
  for (let i = 0; i < len; i++) {
    if (original[i] !== mutated[i]) {
      flips.push({
        position: i + 1,
        from: original[i] || '0',
        to: mutated[i] || '1'
      });
    }
  }
  return flips;
}

/**
 * Formats an accessible aria-live announcement string for the current step.
 * @param {string} phase
 * @param {Object} data
 * @returns {string}
 */
export function formatChromosomeAriaAnnouncement(phase, data = {}) {
  switch (phase) {
    case 'CROSSOVER': {
      const { pairIndex = 1, p1Idx = 1, p2Idx = 2, crossed = false, cutPoint = null } = data;
      if (crossed && cutPoint) {
        return `Crossover pair ${pairIndex}: Parent #${p1Idx} and Parent #${p2Idx} crossed at cut point ${cutPoint}. Offspring tails swapped in 3D.`;
      }
      return `Crossover pair ${pairIndex}: Parent #${p1Idx} and Parent #${p2Idx} unchanged (no crossover).`;
    }
    case 'MUTATE': {
      const { flipCount = 0, childIdx = 1, pos = null, fromVal = '0', toVal = '1', delta = null } = data;
      if (flipCount > 0 && pos) {
        const deltaStr = delta !== null ? ` (delta ${delta >= 0 ? '+' : ''}${Number(delta).toFixed(4)})` : '';
        return `Mutation: Child #${childIdx} bit ${pos} flipped from ${fromVal} to ${toVal}${deltaStr}. Total ${flipCount} bit flip(s).`;
      }
      return `Mutation: no bits flipped in this step.`;
    }
    case 'SELECT': {
      const { id = 1, fitness = null } = data;
      return `Selection: Individual #${id} selected${fitness !== null ? ` with fitness ${Number(fitness).toFixed(4)}` : ''}.`;
    }
    case 'DECODE_EVAL':
    case 'INIT':
    case 'REPLACE':
    default: {
      const { id = 1, chromosome = '' } = data;
      return `Inspecting Individual #${id} with chromosome ${chromosome}.`;
    }
  }
}
