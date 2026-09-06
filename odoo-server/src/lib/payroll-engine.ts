import {
  ContractSnapshot,
  FORMULA_VARIABLES,
  PayslipLine,
  SalaryRuleRecord,
} from "../types/payroll";

/**
 * No working-schedule table exists yet (employee_profiles.working_schedule is a
 * free-text label), so a payroll period expects a standard Monday-Friday week.
 * Replace this with the schedule lookup once schedules are modelled.
 */
export const STANDARD_HOURS_PER_DAY = 8;

const MILLISECONDS_PER_DAY = 86_400_000;

export function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Arithmetic-only expression parser over named rule codes. It never executes
 * JavaScript and never resolves object properties, so a salary rule authored by
 * a payroll manager cannot reach the server runtime.
 */
export function evaluateFormula(
  source: string,
  variables: Record<string, number>,
): number {
  const tokens =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z_0-9]*|[()+\-*/]/g) ??
    [];

  if (
    !source.trim() ||
    tokens.join("") !== source.replace(/\s/g, "") ||
    tokens.length > 200
  ) {
    throw new Error("Use numbers, known codes, parentheses and + - * / only.");
  }

  let index = 0;

  function atom(): number {
    const token = tokens[index++];

    if (token === "+") {
      return atom();
    }

    if (token === "-") {
      return -atom();
    }

    if (token === "(") {
      const value = expression();

      if (tokens[index++] !== ")") {
        throw new Error("Unclosed parentheses.");
      }

      return value;
    }

    if (token && /^(?:\d|\.)/.test(token)) {
      return Number(token);
    }

    if (token && Object.hasOwn(variables, token)) {
      return variables[token];
    }

    throw new Error(
      `Unknown or unavailable formula code: ${token ?? "end of formula"}.`,
    );
  }

  function product(): number {
    let value = atom();

    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = atom();

      if (operator === "/" && right === 0) {
        throw new Error("Division by zero.");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function expression(): number {
    let value = product();

    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = product();

      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  const result = expression();

  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid arithmetic expression.");
  }

  return result;
}

/**
 * Checks that a set of rules can run as a sequence: unique execution order and
 * every referenced code defined by an earlier rule or a payroll input.
 */
export function validateRuleSequence(
  rules: SalaryRuleRecord[],
  uniqueSequences = true,
): string | undefined {
  if (
    uniqueSequences &&
    new Set(rules.map((rule) => rule.sequence)).size !== rules.length
  ) {
    return "Each active rule in a structure must have a unique execution sequence.";
  }

  const codes = new Set<string>(FORMULA_VARIABLES);
  const context: Record<string, number> = Object.fromEntries(
    FORMULA_VARIABLES.map((code) => [code, 1]),
  );

  for (const rule of [...rules].sort((a, b) => a.sequence - b.sequence)) {
    if (codes.has(rule.code)) {
      return `Duplicate or reserved rule code: ${rule.code}.`;
    }

    try {
      if (rule.method === "percentage") {
        evaluateFormula(rule.base, context);
      } else if (rule.method === "formula") {
        evaluateFormula(rule.formula, context);
      }
    } catch (error) {
      return `${rule.name}: ${(error as Error).message}`;
    }

    codes.add(rule.code);
    context[rule.code] = 1;
  }

  return undefined;
}

export function periodDays(startDate: string, endDate: string): number {
  return (Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY + 1;
}

/** Monday-Friday days in the period, and the hours they are expected to cover. */
export function expectedWork(
  startDate: string,
  endDate: string,
): { expectedDays: number; expectedHours: number } {
  let expectedDays = 0;

  for (
    let time = Date.parse(startDate);
    time <= Date.parse(endDate);
    time += MILLISECONDS_PER_DAY
  ) {
    const weekday = new Date(time).getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      expectedDays += 1;
    }
  }

  return {
    expectedDays,
    expectedHours: round(expectedDays * STANDARD_HOURS_PER_DAY),
  };
}

/**
 * Prorates a wage onto the period. Monthly and yearly wages are scaled by the
 * share of each calendar month the period covers; hourly wages follow attendance.
 */
export function periodWage(
  contract: ContractSnapshot,
  startDate: string,
  endDate: string,
  workedHours: number,
): number {
  if (contract.wagePeriod === "hour") {
    return round(contract.wage * workedHours);
  }

  let monthlyFactor = 0;

  for (
    let time = Date.parse(startDate);
    time <= Date.parse(endDate);
    time += MILLISECONDS_PER_DAY
  ) {
    const date = new Date(time);
    const daysInMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();

    monthlyFactor += 1 / daysInMonth;
  }

  const monthlyWage =
    contract.wagePeriod === "year" ? contract.wage / 12 : contract.wage;

  return round(monthlyWage * monthlyFactor);
}

export type PayslipComputation = {
  lines: PayslipLine[];
  basic: number;
  allowances: number;
  deductions: number;
  contributions: number;
  gross: number;
  net: number;
};

/**
 * Runs the structure's rules in sequence and totals the payslip. Every rule
 * result is published under its code so later rules can reference it.
 */
export function runSalaryRules(
  rules: SalaryRuleRecord[],
  inputs: Record<string, number>,
  warn: (code: string, message: string, blocking?: boolean) => void,
): PayslipComputation {
  const lines: PayslipLine[] = [];
  const variables: Record<string, number> = { ...inputs };
  const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);

  for (const rule of ordered) {
    try {
      const computed =
        rule.method === "fixed"
          ? rule.amount
          : rule.method === "percentage"
            ? (evaluateFormula(rule.base, variables) * rule.percentage) / 100
            : evaluateFormula(rule.formula, variables);
      const amount = round(computed * rule.quantity);

      if (!Number.isFinite(amount)) {
        throw new Error("Amount is not finite.");
      }

      variables[rule.code] = amount;
      lines.push({
        ruleId: rule.id,
        name: rule.name,
        code: rule.code,
        category: rule.category,
        sequence: rule.sequence,
        amount,
      });
    } catch (error) {
      warn("formula", `${rule.name}: ${(error as Error).message}`);
      break;
    }
  }

  const total = (category: string): number =>
    round(
      lines
        .filter((line) => line.category === category)
        .reduce((sum, line) => sum + line.amount, 0),
    );

  const basic = total("basic");
  const allowances = total("allowance");
  const deductions = total("deduction");
  const contributions = total("contribution");
  const gross = lines.some((line) => line.category === "gross")
    ? total("gross")
    : round(basic + allowances);
  const net = lines.some((line) => line.category === "net")
    ? total("net")
    : round(gross - deductions);

  return {
    lines,
    basic,
    allowances,
    deductions,
    contributions,
    gross,
    net,
  };
}
