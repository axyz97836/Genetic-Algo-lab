/**
 * js/engine/rng.js - Injected RNG implementations.
 * Pure deterministic algorithms: Mulberry32 (seeded free play) & ScriptedRNG (preset replay).
 */

export class Mulberry32 {
  constructor(seed = 12345) {
    this.seed = seed >>> 0;
    this.s = this.seed;
  }

  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  roulette() {
    return this.next();
  }

  tourn(N = 4) {
    const i = Math.floor(this.next() * N) + 1;
    const j = Math.floor(this.next() * N) + 1;
    return [i, j];
  }

  cross() {
    return this.next();
  }

  cutPoint(L = 8) {
    // Cut point uniformly in 1 .. L-1
    return Math.floor(this.next() * (L - 1)) + 1;
  }

  mut() {
    return this.next();
  }
}

export class ScriptedRNG {
  constructor(queues = {}, generation = 1, N = 4) {
    this.gen = generation;
    this.N = N;
    this.queues = {
      roulette: Array.isArray(queues.roulette) ? [...queues.roulette] : [],
      tourn: Array.isArray(queues.tourn) ? [...queues.tourn] : [],
      cross: Array.isArray(queues.cross) ? [...queues.cross] : [],
      cut: Array.isArray(queues.cut) ? [...queues.cut] : [],
      mut: Array.isArray(queues.mut) ? [...queues.mut] : []
    };
    this.ptrs = {
      roulette: 0,
      tourn: 0,
      cross: 0,
      cut: 0,
      mut: 0
    };
  }

  setGeneration(generation, newQueues = null) {
    this.gen = generation;
    if (newQueues) {
      this.queues = {
        roulette: Array.isArray(newQueues.roulette) ? [...newQueues.roulette] : [],
        tourn: Array.isArray(newQueues.tourn) ? [...newQueues.tourn] : [],
        cross: Array.isArray(newQueues.cross) ? [...newQueues.cross] : [],
        cut: Array.isArray(newQueues.cut) ? [...newQueues.cut] : [],
        mut: Array.isArray(newQueues.mut) ? [...newQueues.mut] : []
      };
      this.ptrs = { roulette: 0, tourn: 0, cross: 0, cut: 0, mut: 0 };
    }
  }

  _draw(name) {
    const q = this.queues[name];
    const ptr = this.ptrs[name];
    if (ptr >= q.length) {
      throw new Error(`ScriptedRNG queue "${name}" exhausted at generation ${this.gen}, index ${ptr}`);
    }
    const val = q[ptr];
    this.ptrs[name] = ptr + 1;
    return val;
  }

  roulette() {
    const val = this._draw('roulette');
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(`ScriptedRNG roulette draw out of range [0, 1] at generation ${this.gen}, index ${this.ptrs.roulette - 1}: ${val}`);
    }
    return val;
  }

  tourn() {
    const val = this._draw('tourn');
    if (!Array.isArray(val) || val.length !== 2 || typeof val[0] !== 'number' || typeof val[1] !== 'number') {
      throw new Error(`ScriptedRNG tourn draw invalid at generation ${this.gen}, index ${this.ptrs.tourn - 1}: ${JSON.stringify(val)}`);
    }
    return val;
  }

  cross() {
    const val = this._draw('cross');
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(`ScriptedRNG cross draw out of range [0, 1] at generation ${this.gen}, index ${this.ptrs.cross - 1}: ${val}`);
    }
    return val;
  }

  cutPoint(L) {
    const val = this._draw('cut');
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val >= L) {
      throw new Error(`ScriptedRNG cutPoint draw out of range [1, ${L - 1}] at generation ${this.gen}, index ${this.ptrs.cut - 1}: ${val}`);
    }
    return val;
  }

  mut() {
    const val = this._draw('mut');
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(`ScriptedRNG mut draw out of range [0, 1] at generation ${this.gen}, index ${this.ptrs.mut - 1}: ${val}`);
    }
    return val;
  }
}
