import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { parseOrThrow } from "../lib/validate";
import { getPayrollDashboard } from "../services/payroll-dashboard.service";
import { payrollDashboardQuerySchema } from "../types/payroll.dto";

// Reporting does not require the optional payslip email-delivery dependencies.
export const payrollDashboardRouter = Router();

payrollDashboardRouter.get(
  "/",
  requireAuth,
  requirePermission("payslip:read"),
  async (req, res) => {
    const query = parseOrThrow(payrollDashboardQuerySchema, req.query);
    res.json({ success: true, data: await getPayrollDashboard(query) });
  },
);
