import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  requireAnyPermission,
  requirePermission,
} from "../middlewares/permission.middleware";
import {
  approveTimeOffRequestHandler,
  createTimeOffRequestHandler,
  deleteTimeOffRequestHandler,
  getTimeOffRequestHandler,
  listMyTimeOffRequestsHandler,
  listTimeOffRequestsHandler,
  rejectTimeOffRequestHandler,
  updateTimeOffRequestHandler,
} from "../controllers/timeOff.controller";

export const timeOffRouter = Router();

timeOffRouter.use(requireAuth);

// Declared before "/:id" so the literal path is not swallowed by it.
timeOffRouter.get(
  "/me",
  requirePermission("time_off:read:own"),
  listMyTimeOffRequestsHandler,
);

timeOffRouter.post(
  "/",
  requireAnyPermission("time_off:create:own", "time_off:create:any"),
  createTimeOffRequestHandler,
);

timeOffRouter.get(
  "/",
  requirePermission("time_off:read:any"),
  listTimeOffRequestsHandler,
);

// The service narrows this to the caller's own record unless they hold read:any.
timeOffRouter.get(
  "/:id",
  requireAnyPermission("time_off:read:own", "time_off:read:any"),
  getTimeOffRequestHandler,
);

timeOffRouter.patch(
  "/:id",
  requirePermission("time_off:update:any"),
  updateTimeOffRequestHandler,
);

timeOffRouter.post(
  "/:id/approve",
  requirePermission("time_off:approve"),
  approveTimeOffRequestHandler,
);

timeOffRouter.post(
  "/:id/reject",
  requirePermission("time_off:approve"),
  rejectTimeOffRequestHandler,
);

timeOffRouter.delete(
  "/:id",
  requirePermission("time_off:delete"),
  deleteTimeOffRequestHandler,
);
