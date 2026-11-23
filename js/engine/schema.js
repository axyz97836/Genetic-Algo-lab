/**
 * js/engine/schema.js - Schema metrics, defining span checks, bound calculations, and auto-tracking.
 * Conforms to SPEC.md §5 and §9.
 */

export function analyzeSchema(schemaPattern) {
  const L = schemaPattern.length;
  let o = 0;
  let first = -1;
  let last = -1;

  for (let i = 0; i < L; i++) {
    const ch = schemaPattern[i];
    if (ch === '0' || ch === '1') {
      o++;
      const pos1Based = i + 1;
      if (first === -1) first = pos1Based;
      last = pos1Based;
    }
  }

  const d = (o <= 1 || first === -1) ? 0 : (last - first);

  return {
    pattern: schemaPattern,
    L,
    order: o,
    definingLength: d,
    firstFixedPos: first,
    lastFixedPos: last
  };
}

export function matchesSchema(chromosome, schemaPattern) {
  if (chromosome.length !== schemaPattern.length) return false;
  for (let i = 0; i < schemaPattern.length; i++) {
    const s = schemaPattern[i];
    if (s !== '*' && s !== chromosome[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a cut point k (1 <= k < L) is strictly INSIDE the defining span.
 * SPEC §5: A cut after position k lies INSIDE the defining span iff first <= k < last.
 */
export function isCutInsideSpan(k, schemaInfo) {
  if (schemaInfo.order <= 1 || schemaInfo.definingLength === 0) return false;
  return k >= schemaInfo.firstFixedPos && k < schemaInfo.lastFixedPos;
}

/**
 * Calculates schema fitness and matching count in a given population.
 */
export function evaluateSchemaInPopulation(schemaPattern, populationChromosomes, selectionFitnessArray) {
  const schemaInfo = analyzeSchema(schemaPattern);
  const matchingIndices = [];
  let sumFitness = 0;

  for (let i = 0; i < populationChromosomes.length; i++) {
    if (matchesSchema(populationChromosomes[i], schemaPattern)) {
      matchingIndices.push(i);
      sumFitness += selectionFitnessArray[i];
    }
  }

  const m = matchingIndices.length;
  const f_H = m > 0 ? sumFitness / m : 0;
  const totalPopFitness = selectionFitnessArray.reduce((a, b) => a + b, 0);
  const f_bar = populationChromosomes.length > 0 ? totalPopFitness / populationChromosomes.length : 0;

  return {
    ...schemaInfo,
    m,
    matchingIndices,
    f_H,
    f_bar
  };
}

/**
 * Calculates the theoretical lower bounds for E[m(H, t+1)].
 * SPEC §5:
 * Textbook: m * (f_H / f_bar) * (1 - pc * d / (L - 1) - o * pm), clamped >= 0
 * Exact:    m * (f_H / f_bar) * (1 - pc * d / (L - 1)) * (1 - pm)^o, clamped >= 0
 */
export function calculateSchemaBounds(schemaEval, pc, pm, L) {
  const { m, order: o, definingLength: d, f_H, f_bar } = schemaEval;

  if (m === 0 || f_bar === 0) {
    return {
      textbookBound: 0,
      exactBound: 0,
      fitnessRatio: 0,
      textbookSurvivalFactor: 0,
      exactSurvivalFactor: 0
    };
  }

  const fitnessRatio = f_H / f_bar;
  const crossoverLoss = (pc * d) / (L - 1);

  // Textbook form
  const textbookFactor = 1 - crossoverLoss - o * pm;
  const textbookBound = Math.max(0, m * fitnessRatio * textbookFactor);

  // Exact-mutation form
  const exactCrossoverFactor = 1 - crossoverLoss;
  const exactMutationFactor = Math.pow(1 - pm, o);
  const exactFactor = exactCrossoverFactor * exactMutationFactor;
  const exactBound = Math.max(0, m * fitnessRatio * exactFactor);

  return {
    textbookBound,
    exactBound,
    fitnessRatio,
    textbookSurvivalFactor: textbookFactor,
    exactSurvivalFactor: exactFactor
  };
}

/**
 * Auto-tracks schema from population:
 * Enumerate schemas of order 2-4, keep those with m >= 2 and f(H) > f_bar,
 * pick max f(H)/f_bar, tie -> smaller d, then lexicographic.
 */
export function autoTrackSchema(populationChromosomes, selectionFitnessArray, L) {
  const totalPopFitness = selectionFitnessArray.reduce((a, b) => a + b, 0);
  const f_bar = totalPopFitness / populationChromosomes.length;

  const qualifying = [];

  // Helper to generate candidate schemas of order 2..4 from existing chromosomes
  // (A qualifying schema with m >= 2 must be a sub-pattern common to at least two individuals)
  const candidateSet = new Set();
  const N = populationChromosomes.length;

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const c1 = populationChromosomes[i];
      const c2 = populationChromosomes[j];

      // Find matching positions
      const matchPositions = [];
      for (let pos = 0; pos < L; pos++) {
        if (c1[pos] === c2[pos]) {
          matchPositions.push(pos);
        }
      }

      // Generate combinations of order 2..4 among matching positions
      for (let order = 2; order <= Math.min(4, matchPositions.length); order++) {
        const combos = getCombinations(matchPositions, order);
        for (const combo of combos) {
          const chars = new Array(L).fill('*');
          for (const p of combo) {
            chars[p] = c1[p];
          }
          candidateSet.add(chars.join(''));
        }
      }
    }
  }

  for (const pattern of candidateSet) {
    const res = evaluateSchemaInPopulation(pattern, populationChromosomes, selectionFitnessArray);
    if (res.m >= 2 && res.f_H > f_bar) {
      qualifying.push({
        pattern,
        ratio: res.f_H / f_bar,
        d: res.definingLength,
        ...res
      });
    }
  }

  if (qualifying.length === 0) {
    return null; // "no qualifying schema"
  }

  // Sort: max ratio, then smaller d, then lexicographical
  qualifying.sort((a, b) => {
    if (Math.abs(b.ratio - a.ratio) > 1e-9) return b.ratio - a.ratio;
    if (a.d !== b.d) return a.d - b.d;
    return a.pattern.localeCompare(b.pattern);
  });

  return qualifying[0];
}

function getCombinations(arr, k) {
  const result = [];
  function backtrack(start, current) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}
