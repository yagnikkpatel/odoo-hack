import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import {
  createPayrunSchema,
  createSalaryRuleSchema,
  createSalaryStructureSchema,
  eligibleEmployeesQuerySchema,
  employeeIdParamSchema,
  listPayrunsQuerySchema,
  listPayslipsQuerySchema,
  listSalaryRulesQuerySchema,
  listSalaryStructuresQuerySchema,
  payrollDashboardQuerySchema,
  payrollIdParamSchema,
  sendPayrunPayslipsSchema,
  sendPayslipSchema,
  setBankAccountSchema,
  updatePayrunSchema,
  updateSalaryRuleSchema,
  updateSalaryStructureSchema,
} from "../types/payroll.dto";
import {
  createSalaryRule,
  getSalaryRule,
  listSalaryRules,
  removeSalaryRule,
  updateSalaryRule,
} from "../services/salary-rule.service";
import {
  createSalaryStructure,
  getSalaryStructure,
  listSalaryStructures,
  removeSalaryStructure,
  updateSalaryStructure,
} from "../services/salary-structure.service";
import {
  computePayrun,
  createPayrun,
  getPayrun,
  getPayslip,
  listEligibleEmployees,
  listPayruns,
  listPayslips,
  markPayrunPaid,
  removePayrun,
  removePayslip,
  setEmployeeBankAccount,
  updatePayrun,
  validatePayrun,
} from "../services/payroll.service";
import { getPayrollDashboard } from "../services/payroll-dashboard.service";
import {
  getPayrunDeliveries,
  sendPayrunPayslips,
  sendPayslip,
} from "../services/payslip-delivery.service";

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export async function createSalaryRuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createSalaryRuleSchema, req.body);

  ok(res, await createSalaryRule(input), 201);
}

export async function listSalaryRulesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listSalaryRulesQuerySchema, req.query);

  ok(res, await listSalaryRules(query));
}

export async function getSalaryRuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await getSalaryRule(id));
}

export async function updateSalaryRuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(updateSalaryRuleSchema, req.body);

  ok(res, await updateSalaryRule(id, input));
}

export async function deleteSalaryRuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, { id: await removeSalaryRule(id) });
}

export async function createSalaryStructureHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createSalaryStructureSchema, req.body);

  ok(res, await createSalaryStructure(input), 201);
}

export async function listSalaryStructuresHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listSalaryStructuresQuerySchema, req.query);

  ok(res, await listSalaryStructures(query));
}

export async function getSalaryStructureHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await getSalaryStructure(id));
}

export async function updateSalaryStructureHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(updateSalaryStructureSchema, req.body);

  ok(res, await updateSalaryStructure(id, input));
}

export async function deleteSalaryStructureHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, { id: await removeSalaryStructure(id) });
}

export async function listEligibleEmployeesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(eligibleEmployeesQuerySchema, req.query);

  ok(res, await listEligibleEmployees(query));
}

export async function createPayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createPayrunSchema, req.body);

  ok(res, await createPayrun(input, req.user?.userId), 201);
}

export async function listPayrunsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listPayrunsQuerySchema, req.query);

  ok(res, await listPayruns(query));
}

export async function getPayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await getPayrun(id));
}

export async function updatePayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(updatePayrunSchema, req.body);

  ok(res, await updatePayrun(id, input));
}

export async function deletePayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, { id: await removePayrun(id) });
}

export async function computePayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await computePayrun(id));
}

export async function validatePayrunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await validatePayrun(id));
}

export async function markPayrunPaidHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await markPayrunPaid(id));
}

export async function listPayslipsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listPayslipsQuerySchema, req.query);

  ok(res, await listPayslips(query));
}

export async function getPayslipHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, await getPayslip(id));
}

export async function deletePayslipHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, { payrunId: await removePayslip(id) });
}

export async function setBankAccountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { employeeId } = parseOrThrow(employeeIdParamSchema, req.params);
  const input = parseOrThrow(setBankAccountSchema, req.body);

  ok(res, await setEmployeeBankAccount(employeeId, input.accountNumber));
}

export async function sendPayrunPayslipsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(sendPayrunPayslipsSchema, req.body ?? {});

  // Accepted, not sent: the worker delivers, so the response reports what was
  // queued and what could not be.
  ok(res, await sendPayrunPayslips(id, input, req.user?.userId), 202);
}

export async function sendPayslipHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(sendPayslipSchema, req.body ?? {});

  ok(res, await sendPayslip(id, input, req.user?.userId), 202);
}

export async function listPayrunDeliveriesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);

  ok(res, { deliveries: await getPayrunDeliveries(id) });
}

/**
 * The payroll dashboard: one period of payroll aggregated together with the
 * attendance, time off and contract data that explains it.
 */
export async function getPayrollDashboardHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(payrollDashboardQuerySchema, req.query);

  ok(res, await getPayrollDashboard(query));
}
