/**
 * tests/chromosome-3d.test.mjs
 * Unit tests for 3D chromosome helpers: segment splitting, cut offset, tail swapping,
 * mutation bit diffs, and aria accessibility strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitChromosomeSegments,
  computeCrossoverCutOffset,
  getCrossoverTails,
  detectFlippedBits,
  formatChromosomeAriaAnnouncement
} from '../js/ui/chromosome-3d-helpers.js';

test('3D Chromosome: splitChromosomeSegments splits 8-bit string into two 4-bit segments', () => {
  const res = splitChromosomeSegments('00101000', 4);
  assert.equal(res.seg1, '0010');
  assert.equal(res.seg2, '1000');
  assert.equal(res.len, 8);
});

test('3D Chromosome: computeCrossoverCutOffset calculates horizontal offset with segment gap', () => {
  // Before gap (e.g. k=2)
  const offsetK2 = computeCrossoverCutOffset(2, 34, 14, 4);
  assert.equal(offsetK2, 2 * 34); // 68px

  // At or after segment divider (e.g. k=4, k=6)
  const offsetK4 = computeCrossoverCutOffset(4, 34, 14, 4);
  assert.equal(offsetK4, 4 * 34 + 14); // 136 + 14 = 150px

  const offsetK6 = computeCrossoverCutOffset(6, 34, 14, 4);
  assert.equal(offsetK6, 6 * 34 + 14); // 204 + 14 = 218px
});

test('3D Chromosome: getCrossoverTails accurately produces offspring tails and prefixes', () => {
  const p1 = '00000000';
  const p2 = '11111111';
  const k = 3;
  const res = getCrossoverTails(p1, p2, k);

  assert.equal(res.child1, '00011111');
  assert.equal(res.child2, '11100000');
  assert.equal(res.tail1, '00000');
  assert.equal(res.tail2, '11111');
});

test('3D Chromosome: detectFlippedBits finds bit positions and values', () => {
  const orig = '00101000';
  const mut  = '00111000'; // bit 4 flipped from 0 to 1
  const flips = detectFlippedBits(orig, mut);

  assert.equal(flips.length, 1);
  assert.equal(flips[0].position, 4);
  assert.equal(flips[0].from, '0');
  assert.equal(flips[0].to, '1');
});

test('3D Chromosome: formatChromosomeAriaAnnouncement produces informative aria-live text', () => {
  const crossText = formatChromosomeAriaAnnouncement('CROSSOVER', {
    pairIndex: 1,
    p1Idx: 1,
    p2Idx: 2,
    crossed: true,
    cutPoint: 4
  });
  assert.match(crossText, /Crossover pair 1/);
  assert.match(crossText, /cut point 4/);
  assert.match(crossText, /swapped in 3D/);

  const mutText = formatChromosomeAriaAnnouncement('MUTATE', {
    flipCount: 1,
    childIdx: 1,
    pos: 4,
    fromVal: '0',
    toVal: '1',
    delta: 1.0
  });
  assert.match(mutText, /Child #1 bit 4 flipped from 0 to 1/);
  assert.match(mutText, /Total 1 bit flip\(s\)/);
});
