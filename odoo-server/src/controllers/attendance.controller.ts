import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import {
  attendanceIdParamSchema,
  clockProofSchema,
  createAttendanceSchema,
  listAttendancesQuerySchema,
  myAttendanceQuerySchema,
  updateAttendanceSchema,
} from "../types/attendance.dto";
import {
  checkIn,
  checkOut,
  createAttendance,
  enrollFace,
  getAttendance,
  getMyTodayAttendance,
  getVerificationStatus,
  listAttendances,
  listMyAttendances,
  removeAttendance,
  updateAttendance,
} from "../services/attendance.service";
import { ClockProof } from "../types/attendance";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user.userId;
}

/** Existing web JSON/no-body calls remain valid, but attempted proof cannot
 * silently become an unverified event when files or coordinates are missing. */
export function readClockProof(req: Request): ClockProof | undefined {
  const fields = req.body ?? {};
  const hasProof = Boolean(req.is("multipart/form-data") || req.file) ||
    ["selfie", "latitude", "longitude", "accuracy"].some((key) =>
      Object.prototype.hasOwnProperty.call(fields, key));
  if (!hasProof) return undefined;
  if (!req.file?.buffer?.length) {
    throw new AppError(400, 'Attach a photo as the "selfie" file field', "SELFIE_REQUIRED");
  }
  const position = parseOrThrow(clockProofSchema, fields);
  return {
    selfie: req.file.buffer,
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM: position.accuracy ?? null,
  };
}

export async function checkInHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const attendance = await checkIn(requireUserId(req), readClockProof(req));

  res.status(201).json({
    success: true,
    data: attendance,
  });
}

export async function checkOutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const attendance = await checkOut(requireUserId(req), readClockProof(req));

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

export async function getVerificationStatusHandler(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({ success: true, data: await getVerificationStatus(requireUserId(req)) });
}

export async function enrollFaceHandler(req: Request, res: Response): Promise<void> {
  if (!req.file?.buffer?.length) {
    throw new AppError(400, 'Attach a photo as the "selfie" file field', "SELFIE_REQUIRED");
  }
  res.status(200).json({ success: true, data: await enrollFace(requireUserId(req), req.file.buffer) });
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
