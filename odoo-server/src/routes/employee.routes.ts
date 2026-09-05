import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
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
  listManagersHandler,
  updateEmployeeProfileHandler,
  uploadEmployeeImagesHandler,
} from "../controllers/employee.controller";

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get(
  "/",
  requirePermission("employee:read:any"),
  listEmployeesHandler,
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
  deleteEmployeeImageHandler,
  deleteEmployeeProfileHandler,
);
