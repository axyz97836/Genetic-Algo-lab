/**
 * data/problems.js - Predefined objective problems and safe recursive-descent expression parser.
 * Strict zero-dependency: NO eval(), NO Function() constructor.
 */

// --- 1. SAFE RECURSIVE-DESCENT EXPRESSION PARSER ---

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  VAR: 'VAR',
  OP: 'OP',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  FUNC: 'FUNC',
  EOF: 'EOF'
};

const SUPPORTED_FUNCS = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs']);

export class ParseError extends Error {
  constructor(message, position) {
    super(`Parse error at position ${position}: ${message}`);
    this.name = 'ParseError';
    this.position = position;
  }
}

export function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(', pos: i });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')', pos: i });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: TOKEN_TYPES.COMMA, value: ',', pos: i });
      i++;
      continue;
    }

    if (['+', '-', '*', '/', '^'].includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.OP, value: ch, pos: i });
      i++;
      continue;
    }

    // Number (including decimals)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < n && /\d/.test(input[i + 1]))) {
      const start = i;
      let hasDot = false;
      while (i < n && (/\d/.test(input[i]) || input[i] === '.')) {
        if (input[i] === '.') {
          if (hasDot) break;
          hasDot = true;
        }
        i++;
      }
      const numStr = input.slice(start, i);
      const val = parseFloat(numStr);
      if (Number.isNaN(val)) {
        throw new ParseError(`Invalid number "${numStr}"`, start);
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: val, pos: start });
      continue;
    }

    // Identifiers: variables (x1, x2) or functions (sin, cos, etc.)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(input[i])) {
        i++;
      }
      const ident = input.slice(start, i).toLowerCase();
      if (ident === 'x1' || ident === 'x2') {
        tokens.push({ type: TOKEN_TYPES.VAR, value: ident, pos: start });
      } else if (SUPPORTED_FUNCS.has(ident)) {
        tokens.push({ type: TOKEN_TYPES.FUNC, value: ident, pos: start });
      } else if (ident === 'pi') {
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: Math.PI, pos: start });
      } else if (ident === 'e') {
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: Math.E, pos: start });
      } else {
        throw new ParseError(`Unknown identifier "${ident}"`, start);
      }
      continue;
    }

    throw new ParseError(`Unexpected character "${ch}"`, i);
  }

  tokens.push({ type: TOKEN_TYPES.EOF, value: null, pos: n });
  return tokens;
}

export function parse(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new ParseError('Empty expression', 0);
  }

  const tokens = tokenize(input);
  let cursor = 0;

  function peek() {
    return tokens[cursor];
  }

  function consume(expectedType = null, expectedValue = null) {
    const tok = tokens[cursor];
    if (expectedType && tok.type !== expectedType) {
      throw new ParseError(`Expected ${expectedType} but found ${tok.type}`, tok.pos);
    }
    if (expectedValue !== null && tok.value !== expectedValue) {
      throw new ParseError(`Expected "${expectedValue}" but found "${tok.value}"`, tok.pos);
    }
    cursor++;
    return tok;
  }

  // Precedence:
  // expression -> term ( ('+' | '-') term )*
  // term -> power ( ('*' | '/') power )*
  // power -> unary ( '^' power )?   (right-associative)
  // unary -> ('+' | '-') unary | primary
  // primary -> NUMBER | VAR | FUNC '(' expression ')' | '(' expression ')'

  function parseExpression() {
    let node = parseTerm();
    while (peek().type === TOKEN_TYPES.OP && (peek().value === '+' || peek().value === '-')) {
      const opTok = consume();
      const right = parseTerm();
      node = {
        type: 'BinaryOp',
        op: opTok.value,
        left: node,
        right
      };
    }
    return node;
  }

  function parseTerm() {
    let node = parsePower();
    while (peek().type === TOKEN_TYPES.OP && (peek().value === '*' || peek().value === '/')) {
      const opTok = consume();
      const right = parsePower();
      node = {
        type: 'BinaryOp',
        op: opTok.value,
        left: node,
        right
      };
    }
    return node;
  }

  function parsePower() {
    let node = parseUnary();
    if (peek().type === TOKEN_TYPES.OP && peek().value === '^') {
      consume();
      const right = parsePower(); // right-associative
      node = {
        type: 'BinaryOp',
        op: '^',
        left: node,
        right
      };
    }
    return node;
  }

  function parseUnary() {
    if (peek().type === TOKEN_TYPES.OP && (peek().value === '+' || peek().value === '-')) {
      const opTok = consume();
      const operand = parseUnary();
      return {
        type: 'UnaryOp',
        op: opTok.value,
        argument: operand
      };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();

    if (tok.type === TOKEN_TYPES.NUMBER) {
      consume();
      return { type: 'Literal', value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.VAR) {
      consume();
      return { type: 'Variable', name: tok.value };
    }

    if (tok.type === TOKEN_TYPES.FUNC) {
      const funcTok = consume();
      consume(TOKEN_TYPES.LPAREN, '(');
      const arg = parseExpression();
      consume(TOKEN_TYPES.RPAREN, ')');
      return {
        type: 'FunctionCall',
        name: funcTok.value,
        argument: arg
      };
    }

    if (tok.type === TOKEN_TYPES.LPAREN) {
      consume(TOKEN_TYPES.LPAREN, '(');
      const expr = parseExpression();
      consume(TOKEN_TYPES.RPAREN, ')');
      return expr;
    }

    throw new ParseError(`Unexpected token "${tok.value ?? tok.type}"`, tok.pos);
  }

  const ast = parseExpression();
  if (peek().type !== TOKEN_TYPES.EOF) {
    const extra = peek();
    throw new ParseError(`Unexpected trailing token "${extra.value ?? extra.type}"`, extra.pos);
  }

  return {
    ast,
    evaluate: (x1, x2) => evaluateAst(ast, { x1, x2 })
  };
}

export function evaluateAst(node, vars) {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Variable':
      return vars[node.name] ?? 0;

    case 'UnaryOp': {
      const val = evaluateAst(node.argument, vars);
      return node.op === '-' ? -val : val;
    }

    case 'BinaryOp': {
      const l = evaluateAst(node.left, vars);
      const r = evaluateAst(node.right, vars);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '^': return Math.pow(l, r);
        default: throw new Error(`Unknown operator "${node.op}"`);
      }
    }

    case 'FunctionCall': {
      const arg = evaluateAst(node.argument, vars);
      switch (node.name) {
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'exp': return Math.exp(arg);
        case 'log': return Math.log(arg);
        case 'sqrt': return Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        default: throw new Error(`Unknown function "${node.name}"`);
      }
    }

    default:
      throw new Error(`Unknown AST node type: ${node.type}`);
  }
}

/**
 * Validates a parsed expression on the entire discrete grid.
 * Rejects if any point yields NaN or +/-Infinity.
 */
export function validateOnGrid(parsedExpr, bounds, n) {
  const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;
  const numGrid = 1 << n; // 2^n
  const steps1 = numGrid - 1;
  const steps2 = numGrid - 1;
  const dx1 = steps1 > 0 ? (xmax1 - xmin1) / steps1 : 0;
  const dx2 = steps2 > 0 ? (xmax2 - xmin2) / steps2 : 0;

  for (let d1 = 0; d1 < numGrid; d1++) {
    const x1 = xmin1 + d1 * dx1;
    for (let d2 = 0; d2 < numGrid; d2++) {
      const x2 = xmin2 + d2 * dx2;
      const val = parsedExpr.evaluate(x1, x2);
      if (Number.isNaN(val) || !Number.isFinite(val)) {
        return {
          valid: false,
          error: `Expression evaluates to ${val} at grid point D=(${d1},${d2}), x=(${x1.toFixed(4)},${x2.toFixed(4)})`,
          point: { d1, d2, x1, x2, val }
        };
      }
    }
  }

  return { valid: true };
}


// --- 2. PREDEFINED PROBLEMS ---

export const PROBLEMS = [
  {
    id: 'sphere',
    title: 'Sphere (Sum of Squares)',
    expression: 'x1^2 + x2^2',
    type: 'min',
    bounds: [[0, 15], [0, 15]],
    defaultN: 4,
    fn: (x1, x2) => x1 * x1 + x2 * x2,
    description: 'Convex quadratic bowl with global minimum at (0, 0).'
  },
  {
    id: 'linear_sum',
    title: 'Linear Sum',
    expression: 'x1 + x2',
    type: 'max',
    bounds: [[-8, 7], [-8, 7]],
    defaultN: 4,
    fn: (x1, x2) => x1 + x2,
    description: 'Linear plane; tests negative fitness detection and shift under Roulette.'
  },
  {
    id: 'rosenbrock',
    title: 'Rosenbrock Valley',
    expression: '100 * (x2 - x1^2)^2 + (1 - x1)^2',
    type: 'min',
    bounds: [[-2, 2], [-1, 3]],
    defaultN: 5,
    fn: (x1, x2) => 100 * Math.pow(x2 - x1 * x1, 2) + Math.pow(1 - x1, 2),
    description: 'Classic optimization benchmark with parabolic curved valley.'
  },
  {
    id: 'rastrigin',
    title: 'Rastrigin Function',
    expression: '20 + x1^2 - 10*cos(2*pi*x1) + x2^2 - 10*cos(2*pi*x2)',
    type: 'min',
    bounds: [[-5.12, 5.12], [-5.12, 5.12]],
    defaultN: 5,
    fn: (x1, x2) => 20 + x1 * x1 - 10 * Math.cos(2 * Math.PI * x1) + x2 * x2 - 10 * Math.cos(2 * Math.PI * x2),
    description: 'Highly multimodal landscape with many local optima.'
  }
];

export function getProblemById(id) {
  return PROBLEMS.find(p => p.id === id) || null;
}
