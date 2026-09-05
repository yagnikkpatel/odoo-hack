import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import {
  attendanceIdParamSchema,
  createAttendanceSchema,
  listAttendancesQuerySchema,
  myAttendanceQuerySchema,
  updateAttendanceSchema,
} from "../types/attendance.dto";
import {
  checkIn,
  checkOut,
  createAttendance,
  getAttendance,
  getMyTodayAttendance,
  listAttendances,
  listMyAttendances,
  removeAttendance,
  updateAttendance,
} from "../services/attendance.service";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user.userId;
}

export async function checkInHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const attendance = await checkIn(requireUserId(req));

  res.status(201).json({
    success: true,
    data: attendance,
  });
}

export async function checkOutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const attendance = await checkOut(requireUserId(req));

  res.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function getMyTodayAttendanceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const attendance = await getMyTodayAttendance(requireUserId(req));

  res.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function listMyAttendancesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(myAttendanceQuerySchema, req.query);
  const result = await listMyAttendances(requireUserId(req), query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function createAttendanceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createAttendanceSchema, req.body);
  const attendance = await createAttendance(input);

  res.status(201).json({
    success: true,
    data: attendance,
  });
}

export async function listAttendancesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listAttendancesQuerySchema, req.query);
  const result = await listAttendances(query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getAttendanceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(attendanceIdParamSchema, req.params);
  const attendance = await getAttendance(id);

  res.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function updateAttendanceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(attendanceIdParamSchema, req.params);
  const input = parseOrThrow(updateAttendanceSchema, req.body);
  const attendance = await updateAttendance(id, input, requireUserId(req));

  res.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function deleteAttendanceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(attendanceIdParamSchema, req.params);
  const deletedId = await removeAttendance(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}
