/**
 * js/engine/crossover.js - Single-point crossover on consecutive mating pool pairs.
 * Conforms to SPEC.md §2.
 */

export function runCrossover(matingPoolChromosomes, pc, crossCmp = '<=', rng, n) {
  const L = 2 * n;
  const N = matingPoolChromosomes.length;

  if (N % 2 !== 0) {
    throw new Error(`Population size N must be even for consecutive pairing; received N = ${N}`);
  }

  const numPairs = N / 2;
  const pairs = [];
  const children = [];

  for (let p = 0; p < numPairs; p++) {
    const parent1Idx = 2 * p;
    const parent2Idx = 2 * p + 1;
    const p1 = matingPoolChromosomes[parent1Idx];
    const p2 = matingPoolChromosomes[parent2Idx];

    const randCross = rng.cross();
    const doesCross = crossCmp === '<' ? (randCross < pc) : (randCross <= pc);

    let cutPoint = null;
    let child1 = p1;
    let child2 = p2;
    let isWholeVariableSwap = false;
    let mixedVariable = null;

    if (doesCross) {
      cutPoint = rng.cutPoint(L);
      child1 = p1.slice(0, cutPoint) + p2.slice(cutPoint);
      child2 = p2.slice(0, cutPoint) + p1.slice(cutPoint);

      isWholeVariableSwap = (cutPoint === n);
      mixedVariable = cutPoint < n ? 1 : 2;
    }

    const flag = doesCross
      ? (isWholeVariableSwap ? 'k = n: whole-variable swap: x1 and x2 are exchanged intact' : `variable ${mixedVariable} is rebuilt from mixed bits`)
      : 'no crossover';

    children.push(child1, child2);

    pairs.push({
      pairIndex: p + 1,
      parent1Idx,
      parent2Idx,
      parent1Chrom: p1,
      parent2Chrom: p2,
      randCross,
      rand: randCross,
      doesCross,
      crossed: doesCross,
      cutPoint,
      child1Chrom: child1,
      child2Chrom: child2,
      isWholeVariableSwap,
      mixedVariable,
      flag
    });
  }

  return {
    pairs,
    children
  };
}
