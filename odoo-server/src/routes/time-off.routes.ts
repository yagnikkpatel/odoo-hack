import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  requireAnyPermission,
  requirePermission,
} from "../middlewares/permission.middleware";
import {
  approveAllocationHandler,
  approveRequestHandler,
  cancelRequestHandler,
  createAllocationHandler,
  createRequestHandler,
  createTypeHandler,
  deleteAllocationHandler,
  deleteRequestHandler,
  deleteTypeHandler,
  getAllocationHandler,
  getRequestHandler,
  getTimeOffSnapshotHandler,
  getTypeHandler,
  listAllocationsHandler,
  listMyAllocationsHandler,
  listMyRequestsHandler,
  listRequestsHandler,
  listTypesHandler,
  refuseAllocationHandler,
  refuseRequestHandler,
  updateAllocationHandler,
  updateRequestHandler,
  updateTypeHandler,
} from "../controllers/time-off.controller";

export const timeOffRouter = Router();

timeOffRouter.use(requireAuth);

// The whole module in one round trip: balance and consumption maths spans types,
// allocations and requests together, and this dataset is small by nature.
timeOffRouter.get(
  "/",
  requirePermission("time_off:read:any"),
  getTimeOffSnapshotHandler,
);

timeOffRouter.get(
  "/types",
  requirePermission("time_off:read:any"),
  listTypesHandler,
);

timeOffRouter.post(
  "/types",
  requirePermission("time_off:update:any"),
  createTypeHandler,
);

timeOffRouter.get(
  "/types/:id",
  requirePermission("time_off:read:any"),
  getTypeHandler,
);

timeOffRouter.patch(
  "/types/:id",
  requirePermission("time_off:update:any"),
  updateTypeHandler,
);

timeOffRouter.delete(
  "/types/:id",
  requirePermission("time_off:delete"),
  deleteTypeHandler,
);

// "/allocations/me" is declared before "/allocations/:id" so it is not
// swallowed by the parameterised route.
timeOffRouter.get(
  "/allocations/me",
  requirePermission("time_off:read:own"),
  listMyAllocationsHandler,
);

timeOffRouter.get(
  "/allocations",
  requirePermission("time_off:read:any"),
  listAllocationsHandler,
);

timeOffRouter.post(
  "/allocations",
  requirePermission("time_off:create:any"),
  createAllocationHandler,
);

timeOffRouter.post(
  "/allocations/:id/approve",
  requirePermission("time_off:approve"),
  approveAllocationHandler,
);

timeOffRouter.post(
  "/allocations/:id/refuse",
  requirePermission("time_off:approve"),
  refuseAllocationHandler,
);

timeOffRouter.get(
  "/allocations/:id",
  requirePermission("time_off:read:any"),
  getAllocationHandler,
);

timeOffRouter.patch(
  "/allocations/:id",
  requirePermission("time_off:update:any"),
  updateAllocationHandler,
);

timeOffRouter.delete(
  "/allocations/:id",
  requirePermission("time_off:delete"),
  deleteAllocationHandler,
);

timeOffRouter.get(
  "/requests/me",
  requirePermission("time_off:read:own"),
  listMyRequestsHandler,
);

timeOffRouter.get(
  "/requests",
  requirePermission("time_off:read:any"),
  listRequestsHandler,
);

// Open to both scopes: the service narrows employeeId to the caller's own
// record unless they hold create:any.
timeOffRouter.post(
  "/requests",
  requireAnyPermission("time_off:create:own", "time_off:create:any"),
  createRequestHandler,
);

timeOffRouter.post(
  "/requests/:id/approve",
  requirePermission("time_off:approve"),
  approveRequestHandler,
);

timeOffRouter.post(
  "/requests/:id/refuse",
  requirePermission("time_off:approve"),
  refuseRequestHandler,
);

timeOffRouter.post(
  "/requests/:id/cancel",
  requirePermission("time_off:update:any"),
  cancelRequestHandler,
);

timeOffRouter.get(
  "/requests/:id",
  requirePermission("time_off:read:any"),
  getRequestHandler,
);

timeOffRouter.patch(
  "/requests/:id",
  requirePermission("time_off:update:any"),
  updateRequestHandler,
);

timeOffRouter.delete(
  "/requests/:id",
  requirePermission("time_off:delete"),
  deleteRequestHandler,
);
