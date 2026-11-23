/**
 * js/engine/decode.js - Binary chromosome segment decoding and coordinate mapping.
 * Conforms to SPEC.md §2:
 * Chromosome: n-bit segment for x1 followed by n-bit segment for x2, n in {4,5}, L = 2n.
 * D_j = integer value of segment j in [0, 2^n - 1].
 * Delta x_j = (xmax_j - xmin_j) / (2^n - 1).
 * x_j = xmin_j + D_j * Delta x_j.
 */

export function calculateDeltaX(bounds, n) {
  const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;
  const numSteps = (1 << n) - 1; // 2^n - 1
  if (numSteps <= 0) {
    return [0, 0];
  }
  const dx1 = (xmax1 - xmin1) / numSteps;
  const dx2 = (xmax2 - xmin2) / numSteps;
  return [dx1, dx2];
}

export function decodeChromosome(chromosome, bounds, n) {
  const L = 2 * n;
  if (typeof chromosome !== 'string' || chromosome.length !== L) {
    throw new Error(`Invalid chromosome length: expected ${L} bits, received "${chromosome}" (len ${chromosome?.length})`);
  }

  const seg1 = chromosome.slice(0, n);
  const seg2 = chromosome.slice(n, L);

  const D1 = parseInt(seg1, 2);
  const D2 = parseInt(seg2, 2);

  if (Number.isNaN(D1) || Number.isNaN(D2)) {
    throw new Error(`Invalid non-binary characters in chromosome "${chromosome}"`);
  }

  const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;
  const [dx1, dx2] = calculateDeltaX(bounds, n);

  const x1 = xmin1 + D1 * dx1;
  const x2 = xmin2 + D2 * dx2;

  return {
    D1,
    D2,
    x1,
    x2,
    dx1,
    dx2,
    seg1,
    seg2
  };
}

export function encodeIntegerToBits(D, n) {
  return D.toString(2).padStart(n, '0');
}

export function encodeSegmentsToChromosome(D1, D2, n) {
  const seg1 = encodeIntegerToBits(D1, n);
  const seg2 = encodeIntegerToBits(D2, n);
  return seg1 + seg2;
}
