import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cabinetScope, evaluateFormula, type FormulaScope } from "./formula.ts";

const scope: FormulaScope = {
  H: 34.5,
  W: 36,
  D: 24,
  DOORS: 1,
  DRAWERS: 2,
  SHELVES: 1,
  T: 0.75,
  TOEKICK: 4.5,
  STILE: 1.5,
  RAIL: 1.5,
  TOPRAIL: 1.5,
  NAILER: 1.5,
  SCRIBE: 0,
  DRAWERBOX_CLEAR: 1,
};

function value(expression: string, extra?: FormulaScope): number {
  const result = evaluateFormula(expression, extra ? { ...scope, ...extra } : scope);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function error(expression: string, extra?: FormulaScope): string {
  const result = evaluateFormula(expression, extra ? { ...scope, ...extra } : scope);
  if (result.ok) assert.fail(`Expected an error, got ${result.value}`);
  return result.error;
}

describe("formula examples", () => {
  it("reads a cabinet dimension", () => {
    assert.equal(value("W"), 36);
  });

  it("multiplies height by depth", () => {
    assert.equal(value("H * D"), 34.5 * 24);
  });

  it("subtracts both stiles from the width", () => {
    assert.equal(value("W - (2 * STILE)"), 33);
  });

  it("removes the toe kick from the height", () => {
    assert.equal(value("H - TOEKICK"), 30);
  });

  it("counts two hinges per door", () => {
    assert.equal(value("DOORS * 2"), 2);
  });

  it("picks a count from the cabinet width", () => {
    assert.equal(value("if(W > 30, 2, 1)"), 2);
    assert.equal(value("if(W > 30, 2, 1)", { ...scope, W: 30 }), 1);
    assert.equal(value("if(W > 30, 2, 1)", { ...scope, W: 24 }), 1);
  });
});

describe("formula operations", () => {
  it("honors parentheses, decimals, and left-to-right math", () => {
    assert.equal(value("(H - TOEKICK) * T"), 30 * 0.75);
    assert.equal(value("10 - 3 - 2"), 5);
    assert.equal(value("8 / 2 / 2"), 2);
    assert.equal(value(".5 * 4"), 2);
  });

  it("compares with >= <= == and <", () => {
    assert.equal(value("if(W >= 36, 1, 0)"), 1);
    assert.equal(value("if(W <= 30, 1, 0)"), 0);
    assert.equal(value("if(DOORS == 1, 4, 0)"), 4);
    assert.equal(value("if(DRAWERS < 2, 1, 9)"), 9);
  });

  it("runs min, max, round, ceil, and floor", () => {
    assert.equal(value("min(W, 24, 40)"), 24);
    assert.equal(value("max(DOORS, DRAWERS)"), 2);
    assert.equal(value("round(1.5)"), 2);
    assert.equal(value("ceil(1.1)"), 2);
    assert.equal(value("floor(1.9)"), 1);
    assert.equal(value("MIN(3, 1)"), 1);
  });

  it("allows a negative sign and nested if()", () => {
    assert.equal(value("-W + 40"), 4);
    assert.equal(value("if(W > 30, if(D > 20, 2, 1), 1)"), 2);
  });

  it("uses thickness and shop variables from cabinetScope", () => {
    const built = cabinetScope({
      H: 34.5,
      W: 30,
      D: 24,
      DOORS: 2,
      DRAWERS: 1,
      SHELVES: 2,
      T: 0.75,
      variables: { TOEKICK: 4.5, W: 99 },
    });
    assert.equal(built.W, 30);
    assert.equal(built.T, 0.75);
    assert.deepEqual(evaluateFormula("H - TOEKICK", built), {
      ok: true,
      value: 30,
    });
  });
});

describe("formula errors", () => {
  it("names an unknown variable", () => {
    assert.equal(error("W - stile"), 'Unknown variable "stile"');
    assert.equal(error("H - MISSING"), 'Unknown variable "MISSING"');
  });

  it("rejects a formula that uses thickness before a material is assigned", () => {
    const { T: _thickness, ...withoutThickness } = scope;
    assert.deepEqual(evaluateFormula("T", withoutThickness), {
      ok: false,
      error: 'Unknown variable "T"',
    });
  });

  it("rejects empty input, bad syntax, and the wrong number of arguments", () => {
    assert.equal(error("   "), "Enter a formula");
    assert.equal(error("W +"), "Formula ended too soon");
    assert.equal(error("W + * D"), 'Unexpected "*"');
    assert.equal(error("(W + D"), "Expected a closing parenthesis");
    assert.equal(error("if(W > 30, 2)"), "if() expects 3 arguments: if(condition, when true, when false)");
    assert.equal(error("min(W)"), "min() expects at least 2 arguments");
    assert.equal(error("round(1, 2)"), "round() expects 1 argument");
    assert.equal(error("foo(1)"), 'Unknown function "foo"');
  });

  it("rejects division by zero", () => {
    assert.equal(error("W / 0"), "Division by zero");
    assert.equal(error("W / (DOORS - 1)"), "Division by zero");
  });
});
