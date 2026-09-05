import {
  BankSnapshot,
  ContractSnapshot,
  EmploymentType,
  HOURS_PER_DAY,
  PayrollWarning,
  PayslipLine,
  RuleCategory,
} from "../types/payroll";

/** Inputs every formula can reference, in addition to earlier rule codes. */
export const FORMULA_VARIABLES = [
  "WAGE",
  "PERIOD_DAYS",
  "PAID_DAYS",
  "UNPAID_DAYS",
  "EXPECTED_DAYS",
  "WORKED_DAYS",
  "WORKED_HOURS",
  "OVERTIME_HOURS",
] as const;

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  MIN: (args) => Math.min(...args),
  MAX: (args) => Math.max(...args),
  ABS: (args) => Math.abs(args[0]),
  ROUND: (args) => {
    const factor = 10 ** (args[1] ?? 0);
    return Math.round(args[0] * factor) / factor;
  },
};

export const round = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Small arithmetic evaluator. It never executes JavaScript: only numbers,
 * known variable codes, + - * /, parentheses, MIN/MAX/ABS/ROUND and the
 * comparison operators (which evaluate to 1 or 0, so statutory thresholds such
 * as `(GROSS <= 21000) * 0.0075 * GROSS` can be expressed).
 */
export function evaluateFormula(
  source: string,
  variables: Record<string, number>,
): number {
  const tokens =
    source.match(
      /(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z_0-9]*|<=|>=|==|!=|[()+\-*/,<>]/g,
    ) ?? [];

  if (
    !source.trim() ||
    tokens.join("") !== source.replace(/\s/g, "") ||
    tokens.length > 300
  ) {
    throw new Error(
      "Use numbers, known codes, parentheses, + - * / and MIN/MAX/ROUND only.",
    );
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
      const value = comparison();

      if (tokens[index++] !== ")") {
        throw new Error("Unclosed parentheses.");
      }

      return value;
    }

    if (token && /^(?:\d|\.)/.test(token)) {
      return Number(token);
    }

    if (token && Object.hasOwn(FUNCTIONS, token)) {
      if (tokens[index++] !== "(") {
        throw new Error(`${token} needs parentheses, e.g. ${token}(BASIC, 15000).`);
      }

      const args: number[] = [comparison()];

      while (tokens[index] === ",") {
        index++;
        args.push(comparison());
      }

      if (tokens[index++] !== ")") {
        throw new Error(`Unclosed parentheses after ${token}.`);
      }

      return FUNCTIONS[token](args);
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

  function additive(): number {
    let value = product();

    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function comparison(): number {
    const left = additive();
    const operator = tokens[index];

    if (
      operator === "<" ||
      operator === "<=" ||
      operator === ">" ||
      operator === ">=" ||
      operator === "==" ||
      operator === "!="
    ) {
      index++;
      const right = additive();

      switch (operator) {
        case "<":
          return left < right ? 1 : 0;
        case "<=":
          return left <= right ? 1 : 0;
        case ">":
          return left > right ? 1 : 0;
        case ">=":
          return left >= right ? 1 : 0;
        case "==":
          return left === right ? 1 : 0;
        default:
          return left !== right ? 1 : 0;
      }
    }

    return left;
  }

  const result = comparison();

  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid arithmetic expression.");
  }

  return result;
}

export type EngineRule = {
  id: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  method: "fixed" | "percentage" | "formula";
  amount: number;
  percentage: number;
  base: string;
  formula: string;
  active: boolean;
};

/**
 * Checks that every rule can be evaluated with the codes that precede it.
 * Returns a message describing the first problem, or undefined when valid.
 */
export function validateRules(
  rules: EngineRule[],
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

export type EngineEmployee = {
  id: string;
  name: string;
  email: string;
  department: string;
  jobPosition: string;
  status: string;
};

export type EngineContract = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  wage: number;
  status: string;
  salaryStructureId: string | null;
  employmentType: EmploymentType;
};

export type EngineAttendance = {
  employeeId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  overtimeHours: number;
  status: string;
};

export type EngineLeave = {
  employeeId: string;
  unit: "days" | "hours";
  charges: { date: string; amount: number }[];
};

export type EngineBank = {
  employeeId: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
};

export type EngineOverlap = {
  payslipId: string;
  payrunId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
};

export type ComputeInput = {
  payrunId: string;
  structureId: string;
  startDate: string;
  endDate: string;
  employeeId: string;
  employee: EngineEmployee | null;
  contracts: EngineContract[];
  rules: EngineRule[];
  attendance: EngineAttendance[];
  unpaidLeave: EngineLeave[];
  bank: EngineBank | null;
  overlapping: EngineOverlap[];
};

export type ComputedPayslip = {
  employeeName: string;
  employeeEmail: string;
  department: string;
  jobPosition: string;
  employmentType: EmploymentType;
  periodDays: number;
  paidDays: number;
  unpaidDays: number;
  expectedDays: number;
  workedDays: number;
  workedHours: number;
  overtimeHours: number;
  basic: number;
  allowances: number;
  deductions: number;
  contributions: number;
  gross: number;
  net: number;
  lines: PayslipLine[];
  warnings: PayrollWarning[];
  contractSnapshot: ContractSnapshot | null;
  bankSnapshot: BankSnapshot | null;
};

const DAY_MS = 86_400_000;

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function periodDays(startDate: string, endDate: string): number {
  return Math.round((utcDate(endDate).getTime() - utcDate(startDate).getTime()) / DAY_MS) + 1;
}

/** Monday to Friday days in the period (the fallback working schedule). */
export function expectedWorkingDays(startDate: string, endDate: string): number {
  let count = 0;

  for (
    let time = utcDate(startDate).getTime();
    time <= utcDate(endDate).getTime();
    time += DAY_MS
  ) {
    const day = new Date(time).getUTCDay();

    if (day !== 0 && day !== 6) {
      count++;
    }
  }

  return count;
}

/** Sum of 1/daysInMonth over the period: 1 for a whole calendar month. */
function monthlyFactor(startDate: string, endDate: string): number {
  let factor = 0;

  for (
    let time = utcDate(startDate).getTime();
    time <= utcDate(endDate).getTime();
    time += DAY_MS
  ) {
    const date = new Date(time);
    const daysInMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    factor += 1 / daysInMonth;
  }

  return factor;
}

export type ContractSelection =
  | { ok: true; contract: EngineContract }
  | { ok: false; message: string };

/** The single contract whose dates apply to the whole payroll period. */
export function selectPeriodContract(
  contracts: EngineContract[],
  employeeId: string,
  startDate: string,
  endDate: string,
): ContractSelection {
  const applicable = contracts.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      contract.startDate <= endDate &&
      contract.endDate >= startDate,
  );

  if (applicable.length === 0) {
    return { ok: false, message: "No contract applies to this payroll period." };
  }

  if (applicable.length > 1) {
    return {
      ok: false,
      message:
        "The period spans multiple contracts. Split the payroll period before computing.",
    };
  }

  const [contract] = applicable;

  if (contract.startDate > startDate || contract.endDate < endDate) {
    return {
      ok: false,
      message: `The contract covers ${contract.startDate} to ${contract.endDate}, not the full period.`,
    };
  }

  return { ok: true, contract };
}

export function computePayslip(input: ComputeInput): ComputedPayslip {
  const { employee, employeeId, startDate, endDate } = input;
  const warnings: PayrollWarning[] = [];
  const warn = (code: string, message: string, blocking = true) =>
    warnings.push({ code, message, employeeId, blocking });

  const slip: ComputedPayslip = {
    employeeName: employee?.name ?? "Deleted employee",
    employeeEmail: employee?.email ?? "",
    department: employee?.department ?? "",
    jobPosition: employee?.jobPosition ?? "",
    employmentType: "full_time",
    periodDays: periodDays(startDate, endDate),
    paidDays: 0,
    unpaidDays: 0,
    expectedDays: expectedWorkingDays(startDate, endDate),
    workedDays: 0,
    workedHours: 0,
    overtimeHours: 0,
    basic: 0,
    allowances: 0,
    deductions: 0,
    contributions: 0,
    gross: 0,
    net: 0,
    lines: [],
    warnings,
    contractSnapshot: null,
    bankSnapshot: input.bank
      ? {
          accountHolder: input.bank.accountHolder,
          accountNumberLast4: input.bank.accountNumber.slice(-4),
          ifsc: input.bank.ifsc,
          bankName: input.bank.bankName,
        }
      : null,
  };

  if (!employee) {
    warn("employee", "The selected employee no longer exists.");
  } else if (employee.status !== "active") {
    warn("employee", "The employee account is inactive.", false);
  }

  if (!input.bank) {
    warn(
      "bank",
      "Bank details are missing. Add the account number and IFSC before validation.",
    );
  }

  if (!employee?.email) {
    warn("email", "Work email is missing; payslip delivery is unavailable.", false);
  }

  const duplicate = input.overlapping.find(
    (other) =>
      other.payrunId !== input.payrunId &&
      other.employeeId === employeeId &&
      other.startDate <= endDate &&
      other.endDate >= startDate,
  );

  if (duplicate) {
    warn(
      "duplicate",
      `Another payslip (${duplicate.startDate} to ${duplicate.endDate}) already overlaps this period.`,
    );
  }

  const selection = selectPeriodContract(
    input.contracts,
    employeeId,
    startDate,
    endDate,
  );

  if (!selection.ok) {
    warn("contract", selection.message);

    return slip;
  }

  const { contract } = selection;
  slip.contractSnapshot = {
    id: contract.id,
    startDate: contract.startDate,
    endDate: contract.endDate,
    wage: contract.wage,
    employmentType: contract.employmentType,
    salaryStructureId: contract.salaryStructureId,
  };
  slip.employmentType = contract.employmentType;

  if (contract.salaryStructureId && contract.salaryStructureId !== input.structureId) {
    warn(
      "structure",
      "The contract is assigned a different salary structure than this payrun.",
      false,
    );
  } else if (!contract.salaryStructureId) {
    warn("structure", "The contract has no salary structure assigned.", false);
  }

  const attendance = input.attendance.filter(
    (record) =>
      record.employeeId === employeeId &&
      record.attendanceDate >= startDate &&
      record.attendanceDate <= endDate,
  );
  slip.workedDays = attendance.filter((record) => record.status === "present").length;
  slip.workedHours = round(
    attendance.reduce((sum, record) => sum + Math.max(0, record.workedHours), 0),
  );
  slip.overtimeHours = round(
    attendance.reduce((sum, record) => sum + Math.max(0, record.overtimeHours), 0),
  );

  if (attendance.some((record) => record.checkIn && !record.checkOut)) {
    warn(
      "attendance",
      "Attendance contains missing check-outs. Review worked hours.",
      false,
    );
  }

  slip.unpaidDays = round(
    input.unpaidLeave
      .filter((leave) => leave.employeeId === employeeId)
      .reduce(
        (sum, leave) =>
          sum +
          leave.charges
            .filter((charge) => charge.date >= startDate && charge.date <= endDate)
            .reduce(
              (total, charge) =>
                total + (leave.unit === "hours" ? charge.amount / HOURS_PER_DAY : charge.amount),
              0,
            ),
        0,
      ),
  );
  slip.paidDays = round(Math.max(0, slip.periodDays - slip.unpaidDays));

  const variables: Record<string, number> = {
    WAGE: round(contract.wage * monthlyFactor(startDate, endDate)),
    PERIOD_DAYS: slip.periodDays,
    PAID_DAYS: slip.paidDays,
    UNPAID_DAYS: slip.unpaidDays,
    EXPECTED_DAYS: slip.expectedDays,
    WORKED_DAYS: slip.workedDays,
    WORKED_HOURS: slip.workedHours,
    OVERTIME_HOURS: slip.overtimeHours,
  };

  const rules = input.rules
    .filter((rule) => rule.active)
    .sort((a, b) => a.sequence - b.sequence);

  if (rules.length === 0) {
    warn("rules", "The salary structure has no active rules.");

    return slip;
  }

  const rulesError = validateRules(rules);

  if (rulesError) {
    warn("rules", rulesError);

    return slip;
  }

  for (const rule of rules) {
    try {
      const raw =
        rule.method === "fixed"
          ? rule.amount
          : rule.method === "percentage"
            ? (evaluateFormula(rule.base, variables) * rule.percentage) / 100
            : evaluateFormula(rule.formula, variables);
      const amount = round(raw);

      if (!Number.isFinite(amount)) {
        throw new Error("Amount is not finite.");
      }

      variables[rule.code] = amount;
      slip.lines.push({
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

  const total = (category: RuleCategory) =>
    round(
      slip.lines
        .filter((line) => line.category === category)
        .reduce((sum, line) => sum + line.amount, 0),
    );

  slip.basic = total("basic");
  slip.allowances = total("allowance");
  slip.deductions = total("deduction");
  slip.contributions = total("contribution");
  slip.gross = slip.lines.some((line) => line.category === "gross")
    ? total("gross")
    : round(slip.basic + slip.allowances);
  slip.net = slip.lines.some((line) => line.category === "net")
    ? total("net")
    : round(slip.gross - slip.deductions);

  if (slip.net < 0) {
    warn("negative", "Net salary is negative. Review the salary rules.");
  }

  return slip;
}
