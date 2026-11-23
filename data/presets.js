/**
 * data/presets.js - Predefined benchmark and lecture test presets.
 * Conforms to schema defined in SPEC.md §10.
 */

export const PRESETS = [
  // --- HAND-CALCULATED REFERENCE PRESETS (§9) ---
  {
    id: 'ref-roulette',
    title: 'Hand-Calculated Reference: Roulette (Min Sphere)',
    problemId: 'sphere',
    type: 'min',
    n: 4,
    bounds: [[0, 15], [0, 15]],
    N: 4,
    pc: 0.8,
    pm: 0.05,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'roulette',
    fitnessMode: 'min-inverse',
    C: null,
    decimals: { x1: 0, x2: 0, f: 0, F: 6, p: 5, q: 5 },
    initialPop: [
      '00110101', // c1: D=(3,5), f=34, F=0.028571
      '10010010', // c2: D=(9,2), f=85, F=0.011628
      '01001000', // c3: D=(4,8), f=80, F=0.012346
      '00010110'  // c4: D=(1,6), f=37, F=0.026316
    ],
    generations: [
      {
        // Gen 1
        roulette: [0.20, 0.60, 0.95, 0.40],
        tourn: [],
        cross: [0.50, 0.90],
        cut: [3],
        // 32 draws: all 0.50 except draw 8 = 0.03 (child 1 pos 8) and draw 25 = 0.01 (child 4 pos 1)
        mut: [
          0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.03, // child 1 (pos 1..8)
          0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, // child 2 (pos 1..8)
          0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, // child 3 (pos 1..8)
          0.01, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50  // child 4 (pos 1..8)
        ],
        expected: {
          D1: [3, 9, 4, 1],
          D2: [5, 2, 8, 6],
          x1: [3, 9, 4, 1],
          x2: [5, 2, 8, 6],
          f: [34, 85, 80, 37],
          F: [0.028571, 0.011628, 0.012346, 0.026316],
          p: [0.36230, 0.14745, 0.15655, 0.33370],
          q: [0.36230, 0.50975, 0.66630, 1.00000],
          pool: ['00110101', '01001000', '00010110', '10010010'],
          children: ['00101000', '01010101', '00010110', '10010010'],
          mutated: ['00101001', '01010101', '00010110', '00010010']
        }
      },
      {
        // Gen 2 (stopAfter: DECODE_EVAL)
        stopAfter: 'DECODE_EVAL',
        roulette: [],
        tourn: [],
        cross: [],
        cut: [],
        mut: [],
        expected: {
          D1: [2, 5, 1, 1],
          D2: [9, 5, 6, 2],
          x1: [2, 5, 1, 1],
          x2: [9, 5, 6, 2],
          f: [85, 50, 37, 5],
          F: [0.011628, 0.019608, 0.026316, 0.166667],
          p: null,
          q: null,
          pool: null,
          children: null,
          mutated: null
        }
      }
    ]
  },
  {
    id: 'ref-tournament',
    title: 'Hand-Calculated Reference: Tournament (Min Sphere)',
    problemId: 'sphere',
    type: 'min',
    n: 4,
    bounds: [[0, 15], [0, 15]],
    N: 4,
    pc: 0.8,
    pm: 0.05,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'tournament',
    fitnessMode: 'min-inverse',
    C: null,
    decimals: { x1: 0, x2: 0, f: 0, F: 6, p: 5, q: 5 },
    initialPop: [
      '00110101', // c1: f=34
      '10010010', // c2: f=85
      '01001000', // c3: f=80
      '00010110'  // c4: f=37
    ],
    generations: [
      {
        stopAfter: 'SELECT',
        roulette: [],
        tourn: [[1, 2], [3, 4], [2, 4], [1, 3]], // 1-based indices
        cross: [],
        cut: [],
        mut: [],
        expected: {
          D1: [3, 9, 4, 1],
          D2: [5, 2, 8, 6],
          x1: [3, 9, 4, 1],
          x2: [5, 2, 8, 6],
          f: [34, 85, 80, 37],
          F: [0.028571, 0.011628, 0.012346, 0.026316],
          p: null,
          q: null,
          pool: ['00110101', '00010110', '00010110', '00110101'], // winners: c1, c4, c4, c1
          children: null,
          mutated: null
        }
      }
    ]
  },
  {
    id: 'ref-negative',
    title: 'Hand-Calculated Reference: Negative Fitness Shift',
    problemId: 'linear_sum',
    type: 'max',
    n: 4,
    bounds: [[-8, 7], [-8, 7]],
    N: 2,
    pc: 0.8,
    pm: 0.05,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'roulette',
    fitnessMode: 'max',
    C: null,
    decimals: { x1: 0, x2: 0, f: 0, F: 5, p: 5, q: 5 },
    initialPop: [
      '00000000', // x = (-8, -8), f = -16
      '00010001'  // x = (-7, -7), f = -14
    ],
    generations: [
      {
        stopAfter: 'SELECT',
        roulette: [0.05, 0.50],
        tourn: [],
        cross: [],
        cut: [],
        mut: [],
        expected: {
          D1: [0, 1],
          D2: [0, 1],
          x1: [-8, -7],
          x2: [-8, -7],
          f: [-16, -14],
          F: [-16, -14], // Raw F before shift; F' = [0.2, 2.2]
          p: [0.08333, 0.91667], // shifted p
          q: [0.08333, 1.00000], // shifted q
          pool: ['00000000', '00010001'],
          children: null,
          mutated: null
        }
      }
    ]
  },

  // --- LECTURE NOTE PRESETS ---
  {
    id: 'lecture-sphere-5bit',
    title: 'Lecture Note 1: 5-Bit Sphere Optimization',
    problemId: 'sphere',
    type: 'min',
    n: 5,
    bounds: [[0, 15], [0, 15]],
    N: 4,
    pc: 0.85,
    pm: 0.02,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'roulette',
    fitnessMode: 'min-inverse',
    C: null,
    decimals: { x1: 4, x2: 4, f: 4, F: 6, p: 5, q: 5 },
    initialPop: [
      '0011001101',
      '1001000010',
      '0100101000',
      '0001000110'
    ],
    generations: [
      {
        roulette: [0.15, 0.45, 0.75, 0.90],
        tourn: [],
        cross: [0.40, 0.95],
        cut: [4],
        mut: new Array(40).fill(0.50),
        expected: {
          D1: null, D2: null, x1: null, x2: null, f: null, F: null, p: null, q: null,
          pool: null, children: null, mutated: null
        }
      }
    ]
  },
  {
    id: 'lecture-rosenbrock',
    title: 'Lecture Note 2: Rosenbrock Valley (Minimization)',
    problemId: 'rosenbrock',
    type: 'min',
    n: 5,
    bounds: [[-2, 2], [-1, 3]],
    N: 6,
    pc: 0.8,
    pm: 0.03,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'tournament',
    fitnessMode: 'min-inverse',
    C: null,
    decimals: { x1: 4, x2: 4, f: 4, F: 6, p: 5, q: 5 },
    initialPop: [
      '0101010101',
      '1100100110',
      '0011111000',
      '1010101010',
      '0110010011',
      '1111000001'
    ],
    generations: [
      {
        roulette: [],
        tourn: [[1, 2], [3, 4], [5, 6], [2, 3], [4, 5], [1, 6]],
        cross: [0.25, 0.70, 0.92],
        cut: [3, 6],
        mut: new Array(60).fill(0.50),
        expected: {
          D1: null, D2: null, x1: null, x2: null, f: null, F: null, p: null, q: null,
          pool: null, children: null, mutated: null
        }
      }
    ]
  },
  {
    id: 'lecture-rastrigin',
    title: 'Lecture Note 3: Multimodal Rastrigin',
    problemId: 'rastrigin',
    type: 'min',
    n: 5,
    bounds: [[-5.12, 5.12], [-5.12, 5.12]],
    N: 6,
    pc: 0.9,
    pm: 0.05,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'roulette',
    fitnessMode: 'min-inverse',
    C: null,
    decimals: { x1: 4, x2: 4, f: 4, F: 6, p: 5, q: 5 },
    initialPop: [
      '0001111100',
      '1110000011',
      '0110110010',
      '1001001101',
      '0101001010',
      '1100011000'
    ],
    generations: [
      {
        roulette: [0.10, 0.35, 0.55, 0.70, 0.85, 0.95],
        tourn: [],
        cross: [0.30, 0.50, 0.80],
        cut: [4, 5, 2],
        mut: new Array(60).fill(0.50),
        expected: {
          D1: null, D2: null, x1: null, x2: null, f: null, F: null, p: null, q: null,
          pool: null, children: null, mutated: null
        }
      }
    ]
  },
  {
    id: 'lecture-linear-max',
    title: 'Lecture Note 4: Linear Plane Max (Bounds [-8, 7])',
    problemId: 'linear_sum',
    type: 'max',
    n: 4,
    bounds: [[-8, 7], [-8, 7]],
    N: 4,
    pc: 0.75,
    pm: 0.04,
    crossCmp: '<=',
    mutCmp: '<=',
    selection: 'tournament',
    fitnessMode: 'max',
    C: null,
    decimals: { x1: 2, x2: 2, f: 2, F: 2, p: 4, q: 4 },
    initialPop: [
      '00100010',
      '01100110',
      '10101010',
      '11101110'
    ],
    generations: [
      {
        roulette: [],
        tourn: [[1, 2], [3, 4], [1, 4], [2, 3]],
        cross: [0.30, 0.85],
        cut: [4],
        mut: new Array(32).fill(0.50),
        expected: {
          D1: null, D2: null, x1: null, x2: null, f: null, F: null, p: null, q: null,
          pool: null, children: null, mutated: null
        }
      }
    ]
  }
];

export function getPresetById(id) {
  return PRESETS.find(p => p.id === id) || null;
}
