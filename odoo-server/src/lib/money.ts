/**
 * Payroll arithmetic. Money never touches a JS float — `pg` hands NUMERIC back as a string
 * and it stays a string all the way to the client (BR-X-3). Everything here works in integer
 * minor units internally and rounds half-up once, per call (BR-PAY-15).
 */

const SCALE = 2;
const FACTOR = 10 ** SCALE;

export type Decimal = string;

export function toMinor(value: Decimal | number): number {
  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n)) {
    throw new Error(`not a numeric value: ${value}`);
  }

  return roundHalfUp(n * FACTOR);
}

export function fromMinor(minor: number): Decimal {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);

  return `${sign}${Math.trunc(abs / FACTOR)}.${String(abs % FACTOR).padStart(SCALE, "0")}`;
}

/** Half-up, and symmetric about zero — JS `Math.round(-0.5)` is `-0`, which we do not want. */
function roundHalfUp(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

export function money(value: Decimal | number): Decimal {
  return fromMinor(toMinor(value));
}

export function add(...values: (Decimal | number)[]): Decimal {
  return fromMinor(values.reduce<number>((sum, v) => sum + toMinor(v), 0));
}

export function subtract(a: Decimal | number, b: Decimal | number): Decimal {
  return fromMinor(toMinor(a) - toMinor(b));
}

export function negate(value: Decimal | number): Decimal {
  return fromMinor(-toMinor(value));
}

/** Scale an amount by a plain multiplier (a ratio, not a percentage). */
export function multiply(value: Decimal | number, factor: number): Decimal {
  return fromMinor(roundHalfUp(toMinor(value) * factor));
}

/** `percentage` is expressed as a percent: 40 means 40%. */
export function percentOf(
  base: Decimal | number,
  percentage: Decimal | number,
): Decimal {
  return multiply(base, Number(percentage) / 100);
}

export function isNegative(value: Decimal | number): boolean {
  return toMinor(value) < 0;
}

export function compare(a: Decimal | number, b: Decimal | number): number {
  return toMinor(a) - toMinor(b);
}

export const ZERO: Decimal = "0.00";
