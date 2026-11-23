/**
 * js/engine/engine.js - Pure algorithmic engine orchestrator.
 * Emits immutable ordered StepRecord[] per generation.
 * Conforms to SPEC.md §2 and §3.
 */

import { decodeChromosome } from './decode.js';
import { computeSelectionFitness, calculateLinearShift } from './fitness.js';
import { runRouletteSelection, runTournamentSelection } from './selection.js';
import { runCrossover } from './crossover.js';
import { runMutation } from './mutation.js';

export const STEP_PHASES = {
  INIT: 'INIT',
  DECODE_EVAL: 'DECODE_EVAL',
  SELECT: 'SELECT',
  CROSSOVER: 'CROSSOVER',
  MUTATE: 'MUTATE',
  REPLACE: 'REPLACE'
};

/**
 * Evaluates a list of chromosomes, decoding coordinates and computing fitness.
 */
export function evaluatePopulationChromosomes(chromosomes, params) {
  const { problemFn, problemType, bounds, n, fitnessMode, C } = params;

  const individuals = [];
  let sumF = 0;
  let bestF = problemType === 'min' ? Infinity : -Infinity;
  let worstF = problemType === 'min' ? -Infinity : Infinity;
  let sumObj = 0;
  let bestChrom = null;
  let bestIdx = -1;
  let worstIdx = -1;

  for (let i = 0; i < chromosomes.length; i++) {
    const chrom = chromosomes[i];
    const decoded = decodeChromosome(chrom, bounds, n);
    const f = problemFn(decoded.x1, decoded.x2);
    const F = computeSelectionFitness(f, fitnessMode, C);

    sumObj += f;
    sumF += F;

    const isBetter = problemType === 'min' ? f < bestF : f > bestF;
    if (isBetter || bestIdx === -1) {
      bestF = f;
      bestChrom = chrom;
      bestIdx = i;
    }

    const isWorse = problemType === 'min' ? f > worstF : f < worstF;
    if (isWorse || worstIdx === -1) {
      worstF = f;
      worstIdx = i;
    }

    individuals.push({
      id: i + 1,
      chromosome: chrom,
      ...decoded,
      f,
      F
    });
  }

  const distinctCount = new Set(chromosomes).size;
  const avgF = sumObj / chromosomes.length;

  return {
    individuals,
    stats: {
      bestF,
      avgF,
      worstF,
      bestChrom,
      bestIdx,
      worstIdx,
      distinctCount
    },
    sumF
  };
}

/**
 * Runs a single generation and emits ordered immutable StepRecord[] objects.
 */
export function runGeneration(initialPopulation, params, rng) {
  const {
    problemType = 'min',
    bounds,
    n,
    N = initialPopulation.length,
    pc = 0.8,
    pm = 0.05,
    selection = 'roulette',
    fitnessMode = 'min-inverse',
    crossCmp = '<=',
    mutCmp = '<=',
    elitism = false,
    generationIndex = 1,
    stopAfter = null,
    allowAutoShift = false
  } = params;

  const stepRecords = [];

  // --- 1. DECODE & EVALUATION STEP ---
  const evalResult = evaluatePopulationChromosomes(initialPopulation, params);
  const rawFitnessArray = evalResult.individuals.map(ind => ind.F);
  const shiftCheck = calculateLinearShift(rawFitnessArray);

  const decodeRecord = {
    phase: STEP_PHASES.DECODE_EVAL,
    generationIndex,
    population: evalResult.individuals,
    stats: evalResult.stats,
    shiftCheck,
    isComplete: false
  };
  stepRecords.push(decodeRecord);

  if (stopAfter === STEP_PHASES.DECODE_EVAL) {
    return stepRecords;
  }

  // --- 2. SELECTION STEP ---
  let selectionResult;
  let effectiveFitnessArray = rawFitnessArray;

  if (selection === 'roulette') {
    selectionResult = runRouletteSelection(rawFitnessArray, rng, N, allowAutoShift);
    if (!selectionResult.valid) {
      const selectErrorRecord = {
        phase: STEP_PHASES.SELECT,
        generationIndex,
        error: selectionResult.error,
        message: selectionResult.message,
        shiftInfo: selectionResult.shiftInfo,
        linearShift: selectionResult.shiftInfo,
        isInvalidNegativeFitness: true,
        minFitness: selectionResult.shiftInfo?.minF,
        population: evalResult.individuals,
        stats: evalResult.stats,
        isHalted: true
      };
      stepRecords.push(selectErrorRecord);
      return stepRecords;
    }
    effectiveFitnessArray = selectionResult.effectiveFitness;
  } else {
    // Binary tournament
    selectionResult = runTournamentSelection(evalResult.individuals, problemType, rng, N);
  }

  const matingPool = selectionResult.poolIndices.map(idx => initialPopulation[idx]);

  const selectRecord = {
    phase: STEP_PHASES.SELECT,
    generationIndex,
    selectionScheme: selection,
    selectionResult,
    matingPool,
    matingPoolIndices0Based: selectionResult.poolIndices,
    matingPoolIndices1Based: selectionResult.poolIndices.map(i => i + 1),
    population: evalResult.individuals,
    effectiveFitnessArray,
    stats: evalResult.stats,
    probabilities: selectionResult.p || selectionResult.probabilities || [],
    cumulativeProbabilities: selectionResult.q || selectionResult.cumulativeProbabilities || [],
    rouletteSpins: selectionResult.rValues || [],
    tournaments: selectionResult.rounds || []
  };
  stepRecords.push(selectRecord);

  if (stopAfter === STEP_PHASES.SELECT) {
    return stepRecords;
  }

  // --- 3. CROSSOVER STEP ---
  const crossoverResult = runCrossover(matingPool, pc, crossCmp, rng, n);

  const crossoverRecord = {
    phase: STEP_PHASES.CROSSOVER,
    generationIndex,
    pairs: crossoverResult.pairs,
    crossoverResults: crossoverResult.pairs,
    childrenBeforeMutation: crossoverResult.children,
    stats: evalResult.stats
  };
  stepRecords.push(crossoverRecord);

  if (stopAfter === STEP_PHASES.CROSSOVER) {
    return stepRecords;
  }

  // --- 4. MUTATION STEP ---
  const mutationResult = runMutation(crossoverResult.children, pm, mutCmp, rng, bounds, n);

  const mutationRecord = {
    phase: STEP_PHASES.MUTATE,
    generationIndex,
    childrenBeforeMutation: crossoverResult.children,
    mutatedChildren: mutationResult.mutatedChildren,
    flips: mutationResult.flips,
    allDraws: mutationResult.allDraws,
    mutationResult,
    stats: evalResult.stats
  };
  stepRecords.push(mutationRecord);

  if (stopAfter === STEP_PHASES.MUTATE) {
    return stepRecords;
  }

  // --- 5. REPLACEMENT (GENERATIONAL + OPTIONAL ELITISM) ---
  let finalNewPopulation = [...mutationResult.mutatedChildren];
  let elitismApplied = false;
  let replacedChildIdx = -1;
  let eliteParentChrom = null;

  if (elitism) {
    // Evaluate new children to find worst
    const childEval = evaluatePopulationChromosomes(finalNewPopulation, params);
    const worstChildIdx = childEval.stats.worstIdx;
    const bestOldParentIdx = evalResult.stats.bestIdx;
    const bestOldParentChrom = initialPopulation[bestOldParentIdx];

    // Compare elite parent with best new child
    const isOldBetterThanBestChild = problemType === 'min'
      ? evalResult.stats.bestF < childEval.stats.bestF
      : evalResult.stats.bestF > childEval.stats.bestF;

    // Optional elitism specification: best individual of the old population replaces the worst child
    eliteParentChrom = bestOldParentChrom;
    finalNewPopulation[worstChildIdx] = bestOldParentChrom;
    elitismApplied = true;
    replacedChildIdx = worstChildIdx;
  }

  const newGenEval = evaluatePopulationChromosomes(finalNewPopulation, {
    ...params,
    generationIndex: generationIndex + 1
  });

  const replaceRecord = {
    phase: STEP_PHASES.REPLACE,
    generationIndex,
    nextGenerationIndex: generationIndex + 1,
    oldPopulation: initialPopulation,
    mutatedChildren: mutationResult.mutatedChildren,
    finalNewPopulation,
    elitismApplied,
    replacedChildIdx,
    eliteParentChrom,
    nextGenEvaluation: newGenEval
  };
  stepRecords.push(replaceRecord);

  return stepRecords;
}

/**
 * Timeline Manager for caching and navigating generation records.
 */
export class Timeline {
  constructor(initialPop, params, rng) {
    this.initialPop = [...initialPop];
    this.params = { ...params };
    this.rng = rng;
    this.generationRecords = []; // gen 0, 1, 2...
    this.currentGenIdx = 0;
    this.currentStepIdx = 0;

    this.reset();
  }

  reset() {
    this.generationRecords = [];
    this.currentGenIdx = 0;
    this.currentStepIdx = 0;

    // Generation 0: Initial decode record
    const initEval = evaluatePopulationChromosomes(this.initialPop, this.params);
    const initRecord = {
      phase: STEP_PHASES.INIT,
      generationIndex: 0,
      population: initEval.individuals,
      stats: initEval.stats
    };
    this.generationRecords.push([initRecord]);
  }

  getCurrentRecord() {
    const genSteps = this.generationRecords[this.currentGenIdx];
    if (!genSteps || genSteps.length === 0) return null;
    return genSteps[this.currentStepIdx] || genSteps[genSteps.length - 1];
  }

  getHistory() {
    return this.generationRecords.map((genSteps, idx) => {
      const lastStep = genSteps[genSteps.length - 1];
      return {
        generationIndex: idx,
        stats: lastStep.stats || lastStep.nextGenEvaluation?.stats
      };
    });
  }
}
