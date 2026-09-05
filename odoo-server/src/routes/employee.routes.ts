import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireCurrentEmployeeAccount } from "../middlewares/employee-account.middleware";
import {
  requirePermission,
  requireScopedPermission,
} from "../middlewares/permission.middleware";
import { uploadEmployeeImages } from "../middlewares/upload.middleware";
import {
  createEmployeeProfileHandler,
  deleteEmployeeImageHandler,
  deleteEmployeeProfileHandler,
  getEmployeeProfileHandler,
  listEmployeesHandler,
  listEmployeeAccountsHandler,
  listManagersHandler,
  updateEmployeeProfileHandler,
  uploadEmployeeImagesHandler,
} from "../controllers/employee.controller";

export const employeeRouter = Router();

employeeRouter.use(requireAuth);
employeeRouter.use(requireCurrentEmployeeAccount);

employeeRouter.get(
  "/",
  requirePermission("employee:read:any"),
  listEmployeesHandler,
);

employeeRouter.get(
  "/accounts",
  // HR can select eligible accounts without receiving user-management access.
  requirePermission("employee:create"),
  requirePermission("employee:read:any"),
  listEmployeeAccountsHandler,
);

employeeRouter.get(
  "/managers",
  requirePermission("employee:read:any"),
  listManagersHandler,
);

employeeRouter.post(
  "/:userId",
  requirePermission("employee:create"),
  createEmployeeProfileHandler,
);

employeeRouter.get(
  "/:userId",
  requireScopedPermission("employee:read"),
  getEmployeeProfileHandler,
);

employeeRouter.patch(
  "/:userId",
  requirePermission("employee:update:any"),
  updateEmployeeProfileHandler,
);

employeeRouter.post(
  "/:userId/images",
  requirePermission("employee:update:any"),
  uploadEmployeeImages,
  uploadEmployeeImagesHandler,
);

employeeRouter.delete(
  "/:userId/images/:imageType",
  requirePermission("employee:update:any"),
  deleteEmployeeImageHandler,
);

employeeRouter.delete(
  "/:userId",
  requirePermission("employee:delete"),
  deleteEmployeeProfileHandler,
);
