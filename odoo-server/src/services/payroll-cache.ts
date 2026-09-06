import { bumpCacheVersion, getCacheVersion } from "../lib/cache";

/**
 * Payroll reads cross every entity in the module -- a payrun list carries its
 * structure's name, a payslip its employee's -- so one version covers them all
 * and any payroll write invalidates the whole module rather than guessing which
 * lists a change could reach.
 */
const PAYROLL_NAMESPACE = "payroll";

export async function payrollListCacheKey(
  scope: string,
  parts: Record<string, string | number | boolean | undefined>,
): Promise<string> {
  const version = await getCacheVersion(PAYROLL_NAMESPACE);
  const query = Object.entries(parts)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("&");

  return `${PAYROLL_NAMESPACE}:v${version}:${scope}:${query}`;
}

export async function invalidatePayrollCaches(): Promise<void> {
  await bumpCacheVersion(PAYROLL_NAMESPACE);
}
