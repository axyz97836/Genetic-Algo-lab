/**
 * tests/schema-xray.test.mjs - Dedicated Unit Tests for Schema X-Ray, Auto-Track, and Disruption Logic.
 * Conforms to SPEC.md §5 and §9.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSchema,
  matchesSchema,
  isCutInsideSpan,
  evaluateSchemaInPopulation,
  calculateSchemaBounds,
  autoTrackSchema
} from '../js/engine/schema.js';

import { PRESETS } from '../data/presets.js';

const isClose = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;

test('Schema Analysis: Order o(H), Defining Length d(H), and Fixed Positions', () => {
  // 1. Single fixed bit: o=1, d=0
  const s1 = analyzeSchema('*1******');
  assert.equal(s1.order, 1);
  assert.equal(s1.definingLength, 0);
  assert.equal(s1.firstFixedPos, 2);
  assert.equal(s1.lastFixedPos, 2);

  // 2. All wildcards: o=0, d=0
  const sAll = analyzeSchema('********');
  assert.equal(sAll.order, 0);
  assert.equal(sAll.definingLength, 0);
  assert.equal(sAll.firstFixedPos, -1);
  assert.equal(sAll.lastFixedPos, -1);

  // 3. Ref §9 schema: H = 00****** (L = 8)
  const sRef = analyzeSchema('00******');
  assert.equal(sRef.order, 2);
  assert.equal(sRef.definingLength, 1);
  assert.equal(sRef.firstFixedPos, 1);
  assert.equal(sRef.lastFixedPos, 2);

  // 4. Maximum span schema: 1******0 (L = 8)
  const sMax = analyzeSchema('1******0');
  assert.equal(sMax.order, 2);
  assert.equal(sMax.definingLength, 7);
  assert.equal(sMax.firstFixedPos, 1);
  assert.equal(sMax.lastFixedPos, 8);
});

test('Crossover Defining Span Rule (first <= k < last)', () => {
  const info = analyzeSchema('00******'); // first = 1, last = 2
  assert.equal(isCutInsideSpan(1, info), true);  // 1 <= 1 < 2
  assert.equal(isCutInsideSpan(2, info), false); // 2 is not < 2
  assert.equal(isCutInsideSpan(3, info), false);
  assert.equal(isCutInsideSpan(7, info), false);

  const infoWide = analyzeSchema('*0*1**0*'); // first = 2, last = 7
  assert.equal(isCutInsideSpan(1, infoWide), false);
  assert.equal(isCutInsideSpan(2, infoWide), true);
  assert.equal(isCutInsideSpan(4, infoWide), true);
  assert.equal(isCutInsideSpan(6, infoWide), true);
  assert.equal(isCutInsideSpan(7, infoWide), false);
});

test('Auto-track Schema Algorithm Heuristics', () => {
  // Population where individuals share specific patterns
  const pop = [
    '11001010', // c1
    '11000101', // c2 - shares 1100**** with c1
    '00110011', // c3
    '00111100'  // c4 - shares 0011**** with c3
  ];

  // Let c1 and c2 have much higher fitness
  const fitness = [10.0, 8.0, 1.0, 1.0];
  const L = 8;

  const tracked = autoTrackSchema(pop, fitness, L);
  assert.ok(tracked, 'Should find a qualifying schema');
  assert.equal(tracked.m, 2, 'Matching count must be 2');
  assert.ok(tracked.ratio > 1.0, 'f(H) must exceed f_bar');
  // Ties on ratio (1.8x) and d (1) broken lexicographically ('*' < '1' in ASCII -> '**00****')
  assert.equal(tracked.pattern, '**00****');
});

test('Holland Schema Bounds: Clamping and Exact Matching with SPEC §9', () => {
  const H = '00******';
  const popGen1 = ['00110101', '10010010', '01001000', '00010110'];
  const F_array = [0.028571, 0.011628, 0.012346, 0.026316];
  const pc = 0.8;
  const pm = 0.05;
  const L = 8;

  const evalRes = evaluateSchemaInPopulation(H, popGen1, F_array);
  const bounds = calculateSchemaBounds(evalRes, pc, pm, L);

  // Exact reproduction of Section 9 numbers
  assert.equal(evalRes.m, 2);
  assert.ok(isClose(evalRes.f_H, 0.0274435, 1e-4));
  assert.ok(isClose(evalRes.f_bar, 0.019715, 1e-4));
  assert.ok(isClose(bounds.fitnessRatio, 1.3920, 1e-3));
  assert.ok(isClose(bounds.textbookSurvivalFactor, 0.785714, 1e-4));
  assert.ok(isClose(bounds.exactSurvivalFactor, 0.799357, 1e-4));
  assert.ok(isClose(bounds.textbookBound, 2.187, 0.005));
  assert.ok(isClose(bounds.exactBound, 2.225, 0.005));

  // Clamping test: when survival factor becomes negative (high pc or pm)
  const badBounds = calculateSchemaBounds(evalRes, 1.0, 0.9, L);
  assert.equal(badBounds.textbookBound, 0, 'Textbook bound must clamp at >= 0');
  assert.ok(badBounds.exactBound >= 0, 'Exact bound must be non-negative');
});
