/**
 * Cabinet-part formulas. Numbers only: + - * /, parentheses, decimals,
 * min(), max(), round(), ceil(), floor(), and if(condition, a, b).
 * Comparisons inside if() are > < >= <= ==.
 *
 * Variables are looked up exactly as written. Cabinet sizes and shop
 * standards are uppercase (H, W, D, DOORS, TOEKICK, T, …).
 */

export type FormulaScope = Readonly<Record<string, number>>;

export type FormulaResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export type CabinetFormulaInputs = {
  H: number;
  W: number;
  D: number;
  DOORS: number;
  DRAWERS: number;
  SHELVES: number;
  /** Finished thickness of the material assigned to this part. */
  T?: number;
  /** Codes from costing_variables. Cabinet sizes always win if a code collides. */
  variables?: FormulaScope;
};

const FUNCTIONS = new Set(["min", "max", "round", "ceil", "floor", "if"]);

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

export function cabinetScope(inputs: CabinetFormulaInputs): FormulaScope {
  const scope: Record<string, number> = { ...inputs.variables };
  scope.H = inputs.H;
  scope.W = inputs.W;
  scope.D = inputs.D;
  scope.DOORS = inputs.DOORS;
  scope.DRAWERS = inputs.DRAWERS;
  scope.SHELVES = inputs.SHELVES;
  if (inputs.T != null) scope.T = inputs.T;
  return scope;
}

export function evaluateFormula(
  expression: string,
  scope: FormulaScope
): FormulaResult {
  try {
    const value = new Parser(expression, scope).parse();
    if (!Number.isFinite(value)) {
      return { ok: false, error: "Formula did not return a number" };
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof FormulaError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

class Parser {
  private index = 0;
  private readonly source: string;
  private readonly scope: FormulaScope;

  constructor(source: string, scope: FormulaScope) {
    this.source = source;
    this.scope = scope;
  }

  parse(): number {
    this.skip();
    if (this.done()) throw new FormulaError("Enter a formula");
    const value = this.parseComparison();
    this.skip();
    if (!this.done()) {
      throw new FormulaError(`Unexpected "${this.current()}"`);
    }
    return value;
  }

  private parseComparison(): number {
    const left = this.parseAdditive();
    this.skip();
    const operator = this.readComparison();
    if (!operator) return left;
    const right = this.parseAdditive();
    switch (operator) {
      case ">":
        return left > right ? 1 : 0;
      case "<":
        return left < right ? 1 : 0;
      case ">=":
        return left >= right ? 1 : 0;
      case "<=":
        return left <= right ? 1 : 0;
      case "==":
        return left === right ? 1 : 0;
      default:
        throw new FormulaError(`Unexpected "${operator}"`);
    }
  }

  private parseAdditive(): number {
    let value = this.parseMultiplicative();
    while (true) {
      this.skip();
      const operator = this.current();
      if (operator !== "+" && operator !== "-") break;
      this.index += 1;
      const right = this.parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseMultiplicative(): number {
    let value = this.parseUnary();
    while (true) {
      this.skip();
      const operator = this.current();
      if (operator !== "*" && operator !== "/") break;
      this.index += 1;
      const right = this.parseUnary();
      if (operator === "/" && right === 0) {
        throw new FormulaError("Division by zero");
      }
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  private parseUnary(): number {
    this.skip();
    if (this.current() === "-") {
      this.index += 1;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skip();
    const character = this.current();
    if (!character) throw new FormulaError("Formula ended too soon");

    if (character === "(") {
      this.index += 1;
      const value = this.parseComparison();
      this.skip();
      if (this.current() !== ")") {
        throw new FormulaError("Expected a closing parenthesis");
      }
      this.index += 1;
      return value;
    }

    if (this.isNumberStart(character)) return this.readNumber();

    if (this.isIdentStart(character)) {
      const name = this.readIdent();
      this.skip();
      if (this.current() === "(") return this.callFunction(name);
      if (!Object.prototype.hasOwnProperty.call(this.scope, name)) {
        throw new FormulaError(`Unknown variable "${name}"`);
      }
      return this.scope[name];
    }

    throw new FormulaError(`Unexpected "${character}"`);
  }

  private callFunction(name: string): number {
    const fn = name.toLowerCase();
    if (!FUNCTIONS.has(fn)) {
      throw new FormulaError(`Unknown function "${name}"`);
    }
    const args = this.readArguments();
    if (fn === "if") {
      if (args.length !== 3) {
        throw new FormulaError(
          "if() expects 3 arguments: if(condition, when true, when false)"
        );
      }
      return args[0] !== 0 ? args[1] : args[2];
    }
    if (fn === "min" || fn === "max") {
      if (args.length < 2) {
        throw new FormulaError(`${fn}() expects at least 2 arguments`);
      }
      return fn === "min" ? Math.min(...args) : Math.max(...args);
    }
    if (args.length !== 1) {
      throw new FormulaError(`${fn}() expects 1 argument`);
    }
    if (fn === "round") return Math.round(args[0]);
    if (fn === "ceil") return Math.ceil(args[0]);
    return Math.floor(args[0]);
  }

  private readArguments(): number[] {
    this.index += 1;
    this.skip();
    if (this.current() === ")") {
      this.index += 1;
      return [];
    }
    const args: number[] = [];
    while (true) {
      args.push(this.parseComparison());
      this.skip();
      if (this.current() === ",") {
        this.index += 1;
        continue;
      }
      if (this.current() === ")") {
        this.index += 1;
        return args;
      }
      throw new FormulaError("Expected a comma or closing parenthesis");
    }
  }

  private readComparison(): ">" | "<" | ">=" | "<=" | "==" | null {
    const first = this.current();
    const second = this.source[this.index + 1];
    if (first === ">" && second === "=") {
      this.index += 2;
      return ">=";
    }
    if (first === "<" && second === "=") {
      this.index += 2;
      return "<=";
    }
    if (first === "=" && second === "=") {
      this.index += 2;
      return "==";
    }
    if (first === ">" || first === "<") {
      this.index += 1;
      return first;
    }
    return null;
  }

  private readNumber(): number {
    const start = this.index;
    while (this.isDigit(this.current())) this.index += 1;
    if (this.current() === "." && this.isDigit(this.source[this.index + 1] ?? "")) {
      this.index += 1;
      while (this.isDigit(this.current())) this.index += 1;
    }
    return Number(this.source.slice(start, this.index));
  }

  private readIdent(): string {
    const start = this.index;
    this.index += 1;
    while (this.isIdentPart(this.current())) this.index += 1;
    return this.source.slice(start, this.index);
  }

  private skip(): void {
    while (
      this.current() === " " ||
      this.current() === "\t" ||
      this.current() === "\n" ||
      this.current() === "\r"
    ) {
      this.index += 1;
    }
  }

  private done(): boolean {
    this.skip();
    return this.index >= this.source.length;
  }

  private current(): string {
    return this.source[this.index] ?? "";
  }

  private isNumberStart(character: string): boolean {
    return this.isDigit(character) || (character === "." && this.isDigit(this.source[this.index + 1] ?? ""));
  }

  private isDigit(character: string): boolean {
    return character >= "0" && character <= "9";
  }

  private isIdentStart(character: string): boolean {
    return (
      (character >= "A" && character <= "Z") ||
      (character >= "a" && character <= "z") ||
      character === "_"
    );
  }

  private isIdentPart(character: string): boolean {
    return this.isIdentStart(character) || this.isDigit(character);
  }
}
