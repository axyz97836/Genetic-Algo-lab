/**
 * tests/verify-phase5.test.mjs - Unit tests for Phase 5 Verify Mode engine.
 * Run with: node --test tests/verify-phase5.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { compareCell, verifyGenerationStep, auditPreset } from '../js/engine/verify.js';
import { PRESETS, getPresetById } from '../data/presets.js';

test('compareCell: Number tolerance, exact strings, and excluded nulls (§4.4)', () => {
  // 1. Number comparison with default 6 decimals: tol = 0.5 * 10^-6 + 1e-9 = 5.01e-7
  const resPass = compareCell(0.0285714, 0.028571, 'F', { F: 5 }); // decimals 5 -> tol = 0.5 * 10^-5 = 5e-6
  assert.strictEqual(resPass.status, 'pass');
  assert.strictEqual(resPass.isExcluded, false);

  const resFail = compareCell(0.028571, 0.030000, 'F', { F: 5 });
  assert.strictEqual(resFail.status, 'fail');
  assert.strictEqual(resFail.isExcluded, false);

  // 2. Exact integer comparison: D1=3, tol = 0.5 * 10^0 = 0.5
  const resIntPass = compareCell(3, 3, 'D1', { D1: 0 });
  assert.strictEqual(resIntPass.status, 'pass');

  const resIntFail = compareCell(4, 3, 'D1', { D1: 0 });
  assert.strictEqual(resIntFail.status, 'fail');

  // 3. String exact comparison (strict equality without whitespace collapsing or case folding)
  const resStrPass = compareCell('00110101', '00110101', 'pool');
  assert.strictEqual(resStrPass.status, 'pass');

  const resStrFail = compareCell('00110101', '00110100', 'pool');
  assert.strictEqual(resStrFail.status, 'fail');

  // Exact regression tests:
  // Expected: "00101000", Actual: "00101000 " -> FAIL
  const resTrailingSpace = compareCell('00101000 ', '00101000', 'pool');
  assert.strictEqual(resTrailingSpace.status, 'fail', 'Trailing whitespace must fail exact string check');

  // Expected: "abc", Actual: "ABC" -> FAIL
  const resCaseDiff = compareCell('ABC', 'abc', 'pool');
  assert.strictEqual(resCaseDiff.status, 'fail', 'Case mismatch must fail exact string check');

  // Expected: "a b", Actual: "a  b" -> FAIL
  const resSpaceDiff = compareCell('a  b', 'a b', 'pool');
  assert.strictEqual(resSpaceDiff.status, 'fail', 'Whitespace difference must fail exact string check');

  // Expected: "00101000", Actual: "00101000" -> PASS
  const resExactPass = compareCell('00101000', '00101000', 'pool');
  assert.strictEqual(resExactPass.status, 'pass', 'Identical string must pass exact string check');

  // 4. Null / Undefined expected -> neutral and excluded from total
  const resNull = compareCell(42, null, 'p');
  assert.strictEqual(resNull.status, 'neutral');
  assert.strictEqual(resNull.isExcluded, true);
  assert.strictEqual(resNull.label, 'no reference');
});

test('auditPreset: Full walk of ref-roulette (Gen 1 & 2) produces 100% matches', () => {
  const preset = getPresetById('ref-roulette');
  const audit = auditPreset(preset);

  assert.strictEqual(audit.presetId, 'ref-roulette');
  assert.ok(audit.globalTotal > 0, 'Must have reference cells');
  assert.strictEqual(audit.globalMatched, audit.globalTotal, `All ${audit.globalTotal} reference cells must match`);
  assert.strictEqual(audit.allPassed, true);

  // Gen 1 has 44 cells (D1, D2, x1, x2, f, F, p, q, pool, children, mutated)
  assert.strictEqual(audit.genAudits[0].total, 44);
  assert.strictEqual(audit.genAudits[0].matched, 44);

  // Gen 2 (stopAfter: DECODE_EVAL) has 24 cells (D1, D2, x1, x2, f, F)
  assert.strictEqual(audit.genAudits[1].total, 24);
  assert.strictEqual(audit.genAudits[1].matched, 24);

  // Total: 44 + 24 = 68 cells
  assert.strictEqual(audit.globalTotal, 68);
});

test('auditPreset: Full walk of ref-tournament produces 100% matches', () => {
  const preset = getPresetById('ref-tournament');
  const audit = auditPreset(preset);

  assert.strictEqual(audit.presetId, 'ref-tournament');
  assert.ok(audit.globalTotal > 0);
  assert.strictEqual(audit.globalMatched, audit.globalTotal);
  assert.strictEqual(audit.allPassed, true);
});

test('auditPreset: Walk all presets in presets.js and verify 0 mismatches', () => {
  for (const preset of PRESETS) {
    const audit = auditPreset(preset);
    if (audit.globalTotal > 0) {
      assert.strictEqual(
        audit.globalMatched,
        audit.globalTotal,
        `Preset ${preset.id} had mismatches: ${audit.globalMatched}/${audit.globalTotal}`
      );
    }
  }
});
