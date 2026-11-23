/**
 * js/engine/verify.js - Verification engine for cell-by-cell comparisons and preset audits.
 * Conforms to SPEC.md §4.4, §6 (Phase 5).
 */

import { STEP_PHASES, runGeneration } from './engine.js';
import { ScriptedRNG } from './rng.js';
import { getProblemById } from '../../data/problems.js';

/**
 * Compare an actual value against an expected value from notes/presets.
 * SPEC §4.4:
 * Numbers tolerance: 0.5 * 10^(-decimals) + 1e-9 (default 6 decimals).
 * Strings: exact equality.
 * Null/undefined expected: neutral ("no reference", excluded from totals).
 */
export function compareCell(actual, expected, field = 'default', decimalsConfig = {}) {
  if (expected === null || expected === undefined) {
    return {
      status: 'neutral',
      label: 'no reference',
      actual,
      expected: null,
      isExcluded: true
    };
  }

  // String comparison (e.g. chromosome, pool, children, mutated) - strictly exact per SPEC §4
  if (typeof expected === 'string') {
    const isMatch = (actual === expected);
    return {
      status: isMatch ? 'pass' : 'fail',
      label: isMatch ? '✓' : '✗',
      actual,
      expected,
      isExcluded: false,
      diff: isMatch ? 0 : 1
    };
  }

  // Number comparison (e.g. D1, D2, x1, x2, f, F, p, q)
  const actNum = typeof actual === 'number' ? actual : parseFloat(actual);
  const expNum = typeof expected === 'number' ? expected : parseFloat(expected);

  if (Number.isNaN(actNum) || Number.isNaN(expNum)) {
    return {
      status: 'fail',
      label: '✗',
      actual: actNum,
      expected: expNum,
      isExcluded: false,
      diff: Infinity
    };
  }

  const decimals = decimalsConfig[field] !== undefined ? decimalsConfig[field] : 6;
  const tol = 0.5 * Math.pow(10, -decimals) + 1e-9;
  const diff = Math.abs(actNum - expNum);
  const isMatch = diff <= tol;

  return {
    status: isMatch ? 'pass' : 'fail',
    label: isMatch ? '✓' : '✗',
    actual: actNum,
    expected: expNum,
    tol,
    diff,
    isExcluded: false
  };
}

/**
 * Verify all computed cells of a specific generation step against preset expectations.
 */
export function verifyGenerationStep(stepRecord, presetGenExpected, decimalsConfig = {}, N = 4) {
  if (!presetGenExpected) {
    return {
      hasExpected: false,
      matchedCount: 0,
      totalCount: 0,
      cellResults: {}
    };
  }

  const results = {};
  let matchedCount = 0;
  let totalCount = 0;

  const fields = ['D1', 'D2', 'x1', 'x2', 'f', 'F', 'p', 'q'];

  for (let i = 0; i < N; i++) {
    results[i] = {};
    const ind = stepRecord.population?.[i] || {};

    for (const field of fields) {
      if ((field === 'p' || field === 'q') && !stepRecord.probabilities && !ind.pi) {
        continue; // p and q are not computed until SELECT phase
      }

      let actVal = ind[field];
      if (field === 'p' && stepRecord.probabilities) {
        actVal = stepRecord.probabilities[i];
      } else if (field === 'q' && stepRecord.cumulativeProbabilities) {
        actVal = stepRecord.cumulativeProbabilities[i];
      }

      const expVal = presetGenExpected[field] ? presetGenExpected[field][i] : null;
      const cmp = compareCell(actVal, expVal, field, decimalsConfig);
      results[i][field] = cmp;

      if (!cmp.isExcluded) {
        totalCount++;
        if (cmp.status === 'pass') matchedCount++;
      }
    }
  }

  return {
    hasExpected: true,
    matchedCount,
    totalCount,
    cellResults: results
  };
}

/**
 * Walk a preset through all its defined generations using ScriptedRNG,
 * comparing every cell (D1, D2, x1, x2, f, F, p, q, pool, children, mutated).
 * Returns full verification breakdown per generation and globally.
 */
export function auditPreset(preset, options = {}) {
  const problem = getProblemById(preset.problemId);
  if (!problem) throw new Error(`Unknown problem: ${preset.problemId}`);

  const decimalsConfig = preset.decimals || {};
  const N = preset.N;
  const numGens = preset.generations.length;
  const allowAutoShift = options.allowAutoShift ?? (preset.id === 'ref-negative');

  let currentPop = [...preset.initialPop];
  const genAudits = [];
  let globalMatched = 0;
  let globalTotal = 0;

  for (let g = 0; g < numGens; g++) {
    const genIndex = g + 1;
    const genSpec = preset.generations[g];
    const expected = genSpec.expected;
    const rng = new ScriptedRNG(genSpec, genIndex, N);

    const genParams = {
      problemFn: problem.fn,
      problemType: preset.type,
      bounds: preset.bounds,
      n: preset.n,
      N,
      pc: preset.pc,
      pm: preset.pm,
      selection: preset.selection,
      fitnessMode: preset.fitnessMode,
      C: preset.C,
      elitism: false,
      crossCmp: preset.crossCmp || '<=',
      mutCmp: preset.mutCmp || '<=',
      generationIndex: genIndex,
      stopAfter: genSpec.stopAfter || null,
      allowAutoShift
    };

    let genMatched = 0;
    let genTotal = 0;
    const cellAudits = [];

    let steps = [];
    try {
      steps = runGeneration(currentPop, genParams, rng);
    } catch (err) {
      genAudits.push({
        genIndex,
        error: err.message,
        matched: 0,
        total: 0
      });
      break;
    }

    if (expected) {
      // 1. Decode & Eval cells (D1, D2, x1, x2, f, F)
      const decodeStep = steps.find(s => s.phase === STEP_PHASES.DECODE_EVAL);
      const pop = decodeStep?.population || [];

      for (let i = 0; i < N; i++) {
        const ind = pop[i] || {};
        const fields = ['D1', 'D2', 'x1', 'x2', 'f', 'F'];
        for (const f of fields) {
          const act = ind[f];
          const exp = expected[f]?.[i];
          const cmp = compareCell(act, exp, f, decimalsConfig);
          cellAudits.push({ gen: genIndex, item: `Ind #${i + 1} ${f}`, ...cmp });
          if (!cmp.isExcluded) {
            genTotal++;
            if (cmp.status === 'pass') genMatched++;
          }
        }
      }

      // 2. Selection p, q, and mating pool
      const selectStep = steps.find(s => s.phase === STEP_PHASES.SELECT);
      if (selectStep && expected.p && expected.q) {
        for (let i = 0; i < N; i++) {
          const actP = selectStep.probabilities?.[i];
          const expP = expected.p?.[i];
          const cmpP = compareCell(actP, expP, 'p', decimalsConfig);
          cellAudits.push({ gen: genIndex, item: `Ind #${i + 1} p`, ...cmpP });
          if (!cmpP.isExcluded) {
            genTotal++;
            if (cmpP.status === 'pass') genMatched++;
          }

          const actQ = selectStep.cumulativeProbabilities?.[i];
          const expQ = expected.q?.[i];
          const cmpQ = compareCell(actQ, expQ, 'q', decimalsConfig);
          cellAudits.push({ gen: genIndex, item: `Ind #${i + 1} q`, ...cmpQ });
          if (!cmpQ.isExcluded) {
            genTotal++;
            if (cmpQ.status === 'pass') genMatched++;
          }
        }
      }

      // Mating pool strings
      if (selectStep && expected.pool) {
        for (let i = 0; i < N; i++) {
          const actPool = selectStep.matingPool?.[i];
          const expPool = expected.pool?.[i];
          const cmpPool = compareCell(actPool, expPool, 'pool');
          cellAudits.push({ gen: genIndex, item: `Mating Pool #${i + 1}`, ...cmpPool });
          if (!cmpPool.isExcluded) {
            genTotal++;
            if (cmpPool.status === 'pass') genMatched++;
          }
        }
      }

      // 3. Crossover children
      const crossStep = steps.find(s => s.phase === STEP_PHASES.CROSSOVER);
      if (crossStep && expected.children) {
        for (let i = 0; i < N; i++) {
          const actChild = crossStep.childrenBeforeMutation?.[i];
          const expChild = expected.children?.[i];
          const cmpChild = compareCell(actChild, expChild, 'children');
          cellAudits.push({ gen: genIndex, item: `Child #${i + 1} (Pre-mut)`, ...cmpChild });
          if (!cmpChild.isExcluded) {
            genTotal++;
            if (cmpChild.status === 'pass') genMatched++;
          }
        }
      }

      // 4. Mutated children
      const mutStep = steps.find(s => s.phase === STEP_PHASES.MUTATE);
      if (mutStep && expected.mutated) {
        for (let i = 0; i < N; i++) {
          const actMut = mutStep.mutatedChildren?.[i];
          const expMut = expected.mutated?.[i];
          const cmpMut = compareCell(actMut, expMut, 'mutated');
          cellAudits.push({ gen: genIndex, item: `Child #${i + 1} (Mutated)`, ...cmpMut });
          if (!cmpMut.isExcluded) {
            genTotal++;
            if (cmpMut.status === 'pass') genMatched++;
          }
        }
      }
    }

    globalMatched += genMatched;
    globalTotal += genTotal;

    genAudits.push({
      genIndex,
      matched: genMatched,
      total: genTotal,
      pass: genMatched === genTotal,
      cellAudits
    });

    // Prepare next gen population
    const lastStep = steps[steps.length - 1];
    if (lastStep?.finalNewPopulation) {
      currentPop = lastStep.finalNewPopulation;
    } else if (lastStep?.mutatedChildren) {
      currentPop = lastStep.mutatedChildren;
    } else if (lastStep?.matingPool) {
      currentPop = lastStep.matingPool;
    }

    if (genSpec.stopAfter) break;
  }

  return {
    presetId: preset.id,
    title: preset.title,
    globalMatched,
    globalTotal,
    allPassed: globalMatched === globalTotal && globalTotal > 0,
    genAudits
  };
}
