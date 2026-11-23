/**
 * js/engine/mutation.js - Bit-level mutation with exact weights and coordinate delta calculation.
 * Conforms to SPEC.md §2.
 */

export function runMutation(childrenChromosomes, pm, mutCmp = '<=', rng, bounds, n) {
  const L = 2 * n;
  const N = childrenChromosomes.length;
  const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;
  const dx1 = (xmax1 - xmin1) / ((1 << n) - 1);
  const dx2 = (xmax2 - xmin2) / ((1 << n) - 1);

  const mutatedChildren = [];
  const allDraws = [];
  const flips = [];
  const flipsByChild = Array.from({ length: N }, () => []);

  for (let c = 0; c < N; c++) {
    const originalChrom = childrenChromosomes[c];
    let bits = originalChrom.split('');

    for (let pos = 1; pos <= L; pos++) {
      const bitIdx = pos - 1; // 0-based
      const originalBit = bits[bitIdx];
      const randMut = rng.mut();
      allDraws.push(randMut);

      const doesFlip = mutCmp === '<' ? (randMut < pm) : (randMut <= pm);

      if (doesFlip) {
        const flippedBit = originalBit === '0' ? '1' : '0';
        bits[bitIdx] = flippedBit;

        const variable = pos <= n ? 1 : 2;
        const w = pos <= n ? (n - pos) : (L - pos);
        const dx = variable === 1 ? dx1 : dx2;
        const deltaMagnitude = Math.pow(2, w) * dx;
        const deltaValue = flippedBit === '1' ? deltaMagnitude : -deltaMagnitude;

        const flipRecord = {
          childIndex: c + 1, // 1-based
          childIdx: c,
          bitPosition: pos,  // 1-based (1..L)
          position: pos,
          variable,
          withinSegmentWeight: w, // 0 = LSB, n-1 = MSB
          weight: w,
          originalBit,
          oldBit: originalBit,
          flippedBit,
          newBit: flippedBit,
          deltaValue,
          deltaMagnitude,
          dx
        };

        flips.push(flipRecord);
        flipsByChild[c].push(flipRecord);
      }
    }

    mutatedChildren.push(bits.join(''));
  }

  return {
    mutatedChildren,
    flips,
    flipsByChild,
    allDraws
  };
}
