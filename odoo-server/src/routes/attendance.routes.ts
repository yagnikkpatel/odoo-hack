import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  checkInHandler,
  checkOutHandler,
  createAttendanceHandler,
  deleteAttendanceHandler,
  getAttendanceHandler,
  getMyTodayAttendanceHandler,
  listAttendancesHandler,
  listMyAttendancesHandler,
  updateAttendanceHandler,
} from "../controllers/attendance.controller";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

// Self-service routes are declared before "/:id" so they are not swallowed by it.
attendanceRouter.post(
  "/check-in",
  requirePermission("attendance:create:own"),
  checkInHandler,
);

attendanceRouter.post(
  "/check-out",
  requirePermission("attendance:create:own"),
  checkOutHandler,
);

attendanceRouter.get(
  "/me/today",
  requirePermission("attendance:read:own"),
  getMyTodayAttendanceHandler,
);

attendanceRouter.get(
  "/me",
  requirePermission("attendance:read:own"),
  listMyAttendancesHandler,
);

attendanceRouter.post(
  "/",
  requirePermission("attendance:create:any"),
  createAttendanceHandler,
);

attendanceRouter.get(
  "/",
  requirePermission("attendance:read:any"),
  listAttendancesHandler,
);

attendanceRouter.get(
  "/:id",
  requirePermission("attendance:read:any"),
  getAttendanceHandler,
);

attendanceRouter.patch(
  "/:id",
  requirePermission("attendance:update:any"),
  updateAttendanceHandler,
);

attendanceRouter.delete(
  "/:id",
  requirePermission("attendance:delete"),
  deleteAttendanceHandler,
);
