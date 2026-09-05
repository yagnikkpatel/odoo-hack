import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { uploadAttendanceSelfie } from "../middlewares/upload.middleware";
import {
  checkInHandler,
  checkOutHandler,
  createAttendanceHandler,
  enrollFaceHandler,
  deleteAttendanceHandler,
  getAttendanceHandler,
  getMyTodayAttendanceHandler,
  getVerificationStatusHandler,
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
  uploadAttendanceSelfie,
  checkInHandler,
);

attendanceRouter.post(
  "/check-out",
  requirePermission("attendance:create:own"),
  uploadAttendanceSelfie,
  checkOutHandler,
);

attendanceRouter.get(
  "/me/verification",
  requirePermission("attendance:read:own"),
  getVerificationStatusHandler,
);

attendanceRouter.post(
  "/me/face",
  requirePermission("attendance:create:own"),
  uploadAttendanceSelfie,
  enrollFaceHandler,
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
