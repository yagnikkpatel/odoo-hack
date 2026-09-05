import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import {
  bankDetailsSchema,
  createPayrunSchema,
  createRuleSchema,
  createStructureSchema,
  dashboardQuerySchema,
  employeeIdParamSchema,
  listPayrunsQuerySchema,
  listPayslipsQuerySchema,
  payrollIdParamSchema,
  periodQuerySchema,
  sendPayslipsSchema,
  updateRuleSchema,
  updateStructureSchema,
} from "../types/payroll.dto";
import {
  computePayrun,
  createPayrun,
  createRule,
  createStructure,
  getBankDetails,
  getPayrollDashboard,
  getPayrollSnapshot,
  getPayrun,
  getPayslip,
  getPayslipPdf,
  getRule,
  getStructure,
  listEligibleEmployees,
  listPayruns,
  listPayslips,
  listRules,
  listStructures,
  markPayrunPaid,
  removePayrun,
  removePayslip,
  removeRule,
  removeStructure,
  saveBankDetails,
  sendPayslips,
  updateRule,
  updateStructure,
  validatePayrun,
} from "../services/payroll.service";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user.userId;
}

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export async function getPayrollSnapshotHandler(_req: Request, res: Response): Promise<void> {
  ok(res, await getPayrollSnapshot());
}

// Salary rules

export async function listRulesHandler(_req: Request, res: Response): Promise<void> {
  ok(res, { rules: await listRules() });
}

export async function getRuleHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await getRule(id));
}

export async function createRuleHandler(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createRuleSchema, req.body);
  ok(res, await createRule(input), 201);
}

export async function updateRuleHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(updateRuleSchema, req.body);
  ok(res, await updateRule(id, input));
}

export async function deleteRuleHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, { id: await removeRule(id) });
}

// Salary structures

export async function listStructuresHandler(_req: Request, res: Response): Promise<void> {
  ok(res, { structures: await listStructures() });
}

export async function getStructureHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await getStructure(id));
}

export async function createStructureHandler(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createStructureSchema, req.body);
  ok(res, await createStructure(input), 201);
}

export async function updateStructureHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(updateStructureSchema, req.body);
  ok(res, await updateStructure(id, input));
}

export async function deleteStructureHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, { id: await removeStructure(id) });
}

// Payruns

export async function listPayrunsHandler(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listPayrunsQuerySchema, req.query);
  ok(res, { payruns: await listPayruns(query) });
}

export async function listEligibleEmployeesHandler(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(periodQuerySchema, req.query);
  ok(res, { employees: await listEligibleEmployees(query) });
}

export async function getPayrunHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await getPayrun(id));
}

export async function createPayrunHandler(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createPayrunSchema, req.body);
  ok(res, await createPayrun(input, requireUserId(req)), 201);
}

export async function computePayrunHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await computePayrun(id));
}

export async function validatePayrunHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await validatePayrun(id));
}

export async function markPayrunPaidHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await markPayrunPaid(id));
}

export async function sendPayslipsHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const input = parseOrThrow(sendPayslipsSchema, req.body ?? {});
  ok(res, await sendPayslips(id, input));
}

export async function deletePayrunHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, { id: await removePayrun(id) });
}

// Payslips

export async function listPayslipsHandler(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listPayslipsQuerySchema, req.query);
  ok(res, { payslips: await listPayslips(query) });
}

export async function getPayslipHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, await getPayslip(id));
}

export async function deletePayslipHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  ok(res, { id: await removePayslip(id) });
}

export async function getPayslipPdfHandler(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(payrollIdParamSchema, req.params);
  const { filename, bytes } = await getPayslipPdf(id);

  res
    .status(200)
    .setHeader("Content-Type", "application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    .setHeader("Cache-Control", "no-store")
    .send(Buffer.from(bytes));
}

// Bank details

export async function getBankDetailsHandler(req: Request, res: Response): Promise<void> {
  const { employeeId } = parseOrThrow(employeeIdParamSchema, req.params);
  ok(res, await getBankDetails(employeeId));
}

export async function saveBankDetailsHandler(req: Request, res: Response): Promise<void> {
  const { employeeId } = parseOrThrow(employeeIdParamSchema, req.params);
  const input = parseOrThrow(bankDetailsSchema, req.body);
  ok(res, await saveBankDetails(employeeId, input));
}

// Dashboard

export async function getDashboardHandler(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(dashboardQuerySchema, req.query);
  ok(res, await getPayrollDashboard(query));
}
