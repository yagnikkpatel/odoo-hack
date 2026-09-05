import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  computePayrunHandler,
  createPayrunHandler,
  createRuleHandler,
  createStructureHandler,
  deletePayrunHandler,
  deletePayslipHandler,
  deleteRuleHandler,
  deleteStructureHandler,
  getBankDetailsHandler,
  getDashboardHandler,
  getPayrollSnapshotHandler,
  getPayrunHandler,
  getPayslipHandler,
  getPayslipPdfHandler,
  getRuleHandler,
  getStructureHandler,
  listEligibleEmployeesHandler,
  listPayrunsHandler,
  listPayslipsHandler,
  listRulesHandler,
  listStructuresHandler,
  markPayrunPaidHandler,
  saveBankDetailsHandler,
  sendPayslipsHandler,
  updateRuleHandler,
  updateStructureHandler,
  validatePayrunHandler,
} from "../controllers/payroll.controller";

export const payrollRouter = Router();

payrollRouter.use(requireAuth);

// One payload for the whole module, matching the time off snapshot.
payrollRouter.get("/", requirePermission("payrun:read"), getPayrollSnapshotHandler);

payrollRouter.get("/dashboard", requirePermission("payroll_dashboard:read"), getDashboardHandler);

payrollRouter.get("/rules", requirePermission("salary_rule:read"), listRulesHandler);
payrollRouter.post("/rules", requirePermission("salary_rule:create"), createRuleHandler);
payrollRouter.get("/rules/:id", requirePermission("salary_rule:read"), getRuleHandler);
payrollRouter.patch("/rules/:id", requirePermission("salary_rule:update"), updateRuleHandler);
payrollRouter.delete("/rules/:id", requirePermission("salary_rule:delete"), deleteRuleHandler);

payrollRouter.get("/structures", requirePermission("salary_structure:read"), listStructuresHandler);
payrollRouter.post("/structures", requirePermission("salary_structure:create"), createStructureHandler);
payrollRouter.get("/structures/:id", requirePermission("salary_structure:read"), getStructureHandler);
payrollRouter.patch("/structures/:id", requirePermission("salary_structure:update"), updateStructureHandler);
payrollRouter.delete("/structures/:id", requirePermission("salary_structure:delete"), deleteStructureHandler);

payrollRouter.get("/payruns", requirePermission("payrun:read"), listPayrunsHandler);
payrollRouter.post("/payruns", requirePermission("payrun:create"), createPayrunHandler);
// Literal path before "/payruns/:id".
payrollRouter.get("/payruns/eligible", requirePermission("payrun:create"), listEligibleEmployeesHandler);
payrollRouter.get("/payruns/:id", requirePermission("payrun:read"), getPayrunHandler);
payrollRouter.delete("/payruns/:id", requirePermission("payrun:delete"), deletePayrunHandler);
payrollRouter.post("/payruns/:id/compute", requirePermission("payrun:update"), computePayrunHandler);
payrollRouter.post("/payruns/:id/validate", requirePermission("payrun:update"), validatePayrunHandler);
payrollRouter.post("/payruns/:id/mark-paid", requirePermission("payrun:update"), markPayrunPaidHandler);
payrollRouter.post("/payruns/:id/send", requirePermission("payrun:update"), sendPayslipsHandler);

payrollRouter.get("/payslips", requirePermission("payslip:read"), listPayslipsHandler);
payrollRouter.get("/payslips/:id", requirePermission("payslip:read"), getPayslipHandler);
payrollRouter.get("/payslips/:id/pdf", requirePermission("payslip:read"), getPayslipPdfHandler);
payrollRouter.delete("/payslips/:id", requirePermission("payslip:delete"), deletePayslipHandler);

payrollRouter.get("/bank-details/:employeeId", requirePermission("payrun:read"), getBankDetailsHandler);
payrollRouter.put("/bank-details/:employeeId", requirePermission("payrun:update"), saveBankDetailsHandler);
