import { getEmailReadiness } from "../lib/payroll-email-readiness";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  computePayrunHandler,
  createPayrunHandler,
  createSalaryRuleHandler,
  createSalaryStructureHandler,
  deletePayrunHandler,
  deletePayslipHandler,
  deleteSalaryRuleHandler,
  deleteSalaryStructureHandler,
  getPayrollDashboardHandler,
  getPayrunHandler,
  getPayslipHandler,
  getSalaryRuleHandler,
  getSalaryStructureHandler,
  listEligibleEmployeesHandler,
  listPayrunDeliveriesHandler,
  listPayrunsHandler,
  listPayslipsHandler,
  listSalaryRulesHandler,
  listSalaryStructuresHandler,
  markPayrunPaidHandler,
  sendPayrunPayslipsHandler,
  sendPayslipHandler,
  setBankAccountHandler,
  updatePayrunHandler,
  updateSalaryRuleHandler,
  updateSalaryStructureHandler,
  validatePayrunHandler,
} from "../controllers/payroll.controller";

export const payrollRouter = Router();

payrollRouter.use(requireAuth);
payrollRouter.get("/delivery-status", requirePermission("payslip:send"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: await getEmailReadiness() });
});

payrollRouter.get(
  "/dashboard",
  requirePermission("payroll_dashboard:read"),
  getPayrollDashboardHandler,
);

payrollRouter.get(
  "/salary-rules",
  requirePermission("salary_rule:read"),
  listSalaryRulesHandler,
);

payrollRouter.post(
  "/salary-rules",
  requirePermission("salary_rule:create"),
  createSalaryRuleHandler,
);

payrollRouter.get(
  "/salary-rules/:id",
  requirePermission("salary_rule:read"),
  getSalaryRuleHandler,
);

payrollRouter.patch(
  "/salary-rules/:id",
  requirePermission("salary_rule:update"),
  updateSalaryRuleHandler,
);

payrollRouter.delete(
  "/salary-rules/:id",
  requirePermission("salary_rule:delete"),
  deleteSalaryRuleHandler,
);

payrollRouter.get(
  "/salary-structures",
  requirePermission("salary_structure:read"),
  listSalaryStructuresHandler,
);

payrollRouter.post(
  "/salary-structures",
  requirePermission("salary_structure:create"),
  createSalaryStructureHandler,
);

payrollRouter.get(
  "/salary-structures/:id",
  requirePermission("salary_structure:read"),
  getSalaryStructureHandler,
);

payrollRouter.patch(
  "/salary-structures/:id",
  requirePermission("salary_structure:update"),
  updateSalaryStructureHandler,
);

payrollRouter.delete(
  "/salary-structures/:id",
  requirePermission("salary_structure:delete"),
  deleteSalaryStructureHandler,
);

// Step one of payrun creation: who can be paid for this scope. Reading it does
// not create anything -- the payrun appears only on POST /payruns.
payrollRouter.get(
  "/eligible-employees",
  requirePermission("payrun:read"),
  listEligibleEmployeesHandler,
);

payrollRouter.get(
  "/payruns",
  requirePermission("payrun:read"),
  listPayrunsHandler,
);

payrollRouter.post(
  "/payruns",
  requirePermission("payrun:create"),
  createPayrunHandler,
);

payrollRouter.get(
  "/payruns/:id",
  requirePermission("payrun:read"),
  getPayrunHandler,
);

payrollRouter.patch(
  "/payruns/:id",
  requirePermission("payrun:update"),
  updatePayrunHandler,
);

payrollRouter.delete(
  "/payruns/:id",
  requirePermission("payrun:delete"),
  deletePayrunHandler,
);

payrollRouter.post(
  "/payruns/:id/compute",
  requirePermission("payslip:create"),
  computePayrunHandler,
);

payrollRouter.post(
  "/payruns/:id/validate",
  requirePermission("payrun:update"),
  validatePayrunHandler,
);

payrollRouter.post(
  "/payruns/:id/mark-paid",
  requirePermission("payrun:update"),
  markPayrunPaidHandler,
);

// Delivery. Emailing payroll to employees is deliberately its own permission:
// it is the one payroll action that leaves the system.
payrollRouter.post(
  "/payruns/:id/send-payslips",
  requirePermission("payslip:send"),
  sendPayrunPayslipsHandler,
);

payrollRouter.get(
  "/payruns/:id/deliveries",
  requirePermission("payslip:read"),
  listPayrunDeliveriesHandler,
);

payrollRouter.post(
  "/payslips/:id/send",
  requirePermission("payslip:send"),
  sendPayslipHandler,
);

payrollRouter.get(
  "/payslips",
  requirePermission("payslip:read"),
  listPayslipsHandler,
);

payrollRouter.get(
  "/payslips/:id",
  requirePermission("payslip:read"),
  getPayslipHandler,
);

payrollRouter.delete(
  "/payslips/:id",
  requirePermission("payslip:delete"),
  deletePayslipHandler,
);

payrollRouter.put(
  "/bank-accounts/:employeeId",
  requirePermission("payslip:update"),
  setBankAccountHandler,
);
