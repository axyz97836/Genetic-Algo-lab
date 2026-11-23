/**
 * tests/print-presets.mjs - Prints the Gen-1 evaluation table for each preset
 * and checks each computed cell against expected reference values.
 */

import { PRESETS } from '../data/presets.js';
import { PROBLEMS, getProblemById } from '../data/problems.js';
import { decodeChromosome } from '../js/engine/decode.js';
import { computeSelectionFitness } from '../js/engine/fitness.js';
import { evaluatePopulationChromosomes } from '../js/engine/engine.js';

console.log('='.repeat(80));
console.log('GA LAB - GENERATION 1 EVALUATION TABLES ACROSS ALL PRESETS');
console.log('='.repeat(80));

let totalCheckedCells = 0;
let totalMatchedCells = 0;
let totalMismatchedCells = 0;
let totalNullExpectedCells = 0;

for (const preset of PRESETS) {
  console.log(`\nPreset: [${preset.id}] "${preset.title}"`);
  console.log(`Problem: ${preset.problemId} | Type: ${preset.type} | Precision n=${preset.n} | N=${preset.N}`);
  console.log(`Bounds: x1=[${preset.bounds[0]}], x2=[${preset.bounds[1]}] | FitnessMode: ${preset.fitnessMode}`);
  console.log('-'.repeat(80));

  const problem = getProblemById(preset.problemId);
  if (!problem) {
    console.error(`Problem "${preset.problemId}" not found!`);
    continue;
  }

  const evalResult = evaluatePopulationChromosomes(preset.initialPop, {
    problemFn: problem.fn,
    problemType: preset.type,
    bounds: preset.bounds,
    n: preset.n,
    fitnessMode: preset.fitnessMode,
    C: preset.C
  });

  const expGen1 = preset.generations[0]?.expected;

  console.log('id | Chromosome | D1 | D2 |   x1   |   x2   |    f(x)    |    F     | Status');
  console.log('---|------------|----|----|--------|--------|------------|----------|-------');

  for (let i = 0; i < evalResult.individuals.length; i++) {
    const ind = evalResult.individuals[i];
    const expD1 = expGen1?.D1 ? expGen1.D1[i] : null;
    const expD2 = expGen1?.D2 ? expGen1.D2[i] : null;
    const expX1 = expGen1?.x1 ? expGen1.x1[i] : null;
    const expX2 = expGen1?.x2 ? expGen1.x2[i] : null;
    const expF_obj = expGen1?.f ? expGen1.f[i] : null;
    const expF_fit = expGen1?.F ? expGen1.F[i] : null;

    let rowStatus = 'PASS';
    const checkCell = (actual, expected, tol = 1e-4) => {
      if (expected === null || expected === undefined) {
        totalNullExpectedCells++;
        return true;
      }
      totalCheckedCells++;
      const match = typeof actual === 'number' && typeof expected === 'number'
        ? Math.abs(actual - expected) <= tol
        : actual === expected;
      if (match) {
        totalMatchedCells++;
      } else {
        totalMismatchedCells++;
        rowStatus = 'MISMATCH';
      }
      return match;
    };

    checkCell(ind.D1, expD1);
    checkCell(ind.D2, expD2);
    checkCell(ind.x1, expX1);
    checkCell(ind.x2, expX2);
    checkCell(ind.f, expF_obj);
    checkCell(ind.F, expF_fit);

    const fStr = typeof ind.f === 'number' ? ind.f.toFixed(4).padStart(10) : String(ind.f).padStart(10);
    const fitStr = typeof ind.F === 'number' ? ind.F.toFixed(6).padStart(8) : String(ind.F).padStart(8);
    const x1Str = ind.x1.toFixed(2).padStart(6);
    const x2Str = ind.x2.toFixed(2).padStart(6);
    const d1Str = String(ind.D1).padStart(2);
    const d2Str = String(ind.D2).padStart(2);

    const statusBadge = expGen1?.f
      ? (rowStatus === 'PASS' ? '✓ OK' : '✗ MISMATCH')
      : 'no ref data';

    console.log(`${String(ind.id).padStart(2)} | ${ind.chromosome} | ${d1Str} | ${d2Str} | ${x1Str} | ${x2Str} | ${fStr} | ${fitStr} | ${statusBadge}`);
  }

  console.log(`Stats -> Best f: ${evalResult.stats.bestF.toFixed(4)}, Avg f: ${evalResult.stats.avgF.toFixed(4)}, Worst f: ${evalResult.stats.worstF.toFixed(4)}, Distinct: ${evalResult.stats.distinctCount}`);
}

console.log('='.repeat(80));
console.log(`Summary: Checked cells with reference: ${totalCheckedCells}`);
console.log(`Matched cells: ${totalMatchedCells} / ${totalCheckedCells}`);
console.log(`Mismatched cells: ${totalMismatchedCells}`);
console.log(`Cells without reference data (expected null): ${totalNullExpectedCells}`);
console.log('='.repeat(80));

if (totalMismatchedCells > 0) {
  process.exit(1);
}
