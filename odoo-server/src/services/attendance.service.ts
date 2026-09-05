import { AppError } from "../errors/AppError";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { describeFace, faceDistance } from "../lib/face";
import { distanceBetween, formatDistance } from "../lib/geo";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { assertIsSupportedImage } from "../lib/imageValidation";
import { enqueueCloudinaryImageDeletion } from "../queues/deleteCloudinaryImage.queue";
import { findVerificationProfile, saveFaceTemplate, VerificationProfile } from "../repositories/employee.repository";
import { invalidateEmployeeCaches } from "./employee.service";
import { StoredImage } from "../types/employee";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import {
  checkInEmployee,
  checkOutEmployee,
  deleteAttendanceById,
  findAllAttendances,
  findAttendanceById,
  findOpenAttendance,
  findTodayAttendance,
  getLocalToday,
  insertAbsentees,
  insertAttendance,
  updateAttendanceById,
} from "../repositories/attendance.repository";
import {
  CreateAttendanceInput,
  ListAttendancesQuery,
  MyAttendanceQuery,
  UpdateAttendanceInput,
} from "../types/attendance.dto";
import {
  AttendanceListResult,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceVerification,
  ClockProof,
  FaceTemplateSource,
  VerificationStatus,
  OPEN_SESSION_MAX_HOURS,
} from "../types/attendance";

const ATTENDANCE_LIST_NAMESPACE = "attendance-list";
const CHECK_IN_LOCK_TTL_SECONDS = 60;

function attendanceCacheKey(id: string): string {
  return `attendance:${id}`;
}

function todayCacheKey(employeeId: string, date: string): string {
  return `attendance:today:${employeeId}:${date}`;
}

function checkInLockKey(employeeId: string): string {
  return `attendance:lock:check-in:${employeeId}`;
}

function attendanceListCacheKey(
  version: number,
  query: ListAttendancesQuery & { employeeId?: string },
): string {
  const parts = [
    `limit=${query.limit}`,
    `offset=${query.offset}`,
    `status=${query.status ?? ""}`,
    `employeeId=${query.employeeId ?? ""}`,
    `from=${query.from ?? ""}`,
    `to=${query.to ?? ""}`,
    `search=${query.search ?? ""}`,
  ];

  return `${ATTENDANCE_LIST_NAMESPACE}:v${version}:${parts.join("&")}`;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function getErrorConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { constraint?: string }).constraint;
}

function toDomainError(error: unknown): AppError | null {
  const code = getErrorCode(error);
  const constraint = getErrorConstraint(error);

  if (code === "23503") {
    return new AppError(404, "Employee not found");
  }

  if (code === "23505") {
    return new AppError(
      409,
      "This employee already has an attendance record for that date",
    );
  }

  if (code === "23514") {
    if (constraint === "attendances_time_order_check") {
      return new AppError(400, "checkOut must be after checkIn");
    }

    if (constraint === "attendances_checkout_requires_checkin_check") {
      return new AppError(400, "checkOut requires checkIn");
    }

    if (constraint === "attendances_overtime_check") {
      return new AppError(400, "overtimeHours must be between 0 and 24");
    }

    if (constraint === "attendances_status_check") {
      return new AppError(400, "Invalid attendance status");
    }

    return new AppError(400, "Attendance violates a database constraint");
  }

  return null;
}

async function invalidateAttendanceCaches(
  attendance: Pick<AttendanceRecord, "id" | "employeeId" | "attendanceDate">,
): Promise<void> {
  await invalidateCache([
    attendanceCacheKey(attendance.id),
    todayCacheKey(attendance.employeeId, attendance.attendanceDate),
  ]);
  await bumpCacheVersion(ATTENDANCE_LIST_NAMESPACE);
}

/**
 * Status follows the timestamps unless a manager states otherwise:
 * both times -> present, check-in only -> incomplete, neither -> absent.
 */
function deriveStatus(
  checkIn: unknown | null,
  checkOut: unknown | null,
): AttendanceStatus {
  if (checkIn && checkOut) {
    return "present";
  }

  if (checkIn) {
    return "incomplete";
  }

  return "absent";
}

function assertNotFuture(value: string | null | undefined, field: string): void {
  if (value && new Date(value).getTime() > Date.now()) {
    throw new AppError(400, `${field} cannot be in the future`);
  }
}

function assertSaneDuration(
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined,
): void {
  if (!checkIn || !checkOut) {
    return;
  }

  const durationHours =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000;

  if (durationHours <= 0) {
    throw new AppError(400, "checkOut must be after checkIn");
  }

  if (durationHours > OPEN_SESSION_MAX_HOURS) {
    throw new AppError(
      400,
      `A single attendance record cannot exceed ${OPEN_SESSION_MAX_HOURS} hours`,
    );
  }
}

async function withClockLock<T>(employeeId: string, operation: () => Promise<T>): Promise<T> {
  const lockKey = checkInLockKey(employeeId);
  const token = randomUUID();
  let lockAcquired = false;

  try {
    lockAcquired =
      (await redis.set(lockKey, token, "EX", CHECK_IN_LOCK_TTL_SECONDS, "NX")) ===
      "OK";
    if (!lockAcquired) throw new AppError(409, "An attendance update is already in progress. Please wait a moment.", "ATTENDANCE_BUSY");
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error, employeeId }, "check-in lock unavailable");
  }

  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  } finally {
    if (lockAcquired) {
      // Never release another request's lock if ours expired during inference.
      await redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1, lockKey, token,
      ).catch(() => undefined);
    }
  }
}

export async function checkIn(employeeId: string, proof?: ClockProof): Promise<AttendanceRecord> {
  return withClockLock(employeeId, async () => {
    // Reject duplicates before spending time on inference or image uploads.
    if (await findTodayAttendance(employeeId)) {
      throw new AppError(409, "You have already checked in today");
    }
    const verification = proof ? await verifyClockProof(employeeId, proof) : null;
    let attendance: AttendanceRecord | null;
    try {
      attendance = await checkInEmployee(employeeId, verification);
      if (!attendance) throw new AppError(409, "You have already checked in today");
    } catch (error) {
      discardSelfie(verification, "check-in rejected");
      throw error;
    }
    // Cleanup must not delete images belonging to an already committed record.
    await invalidateAttendanceCaches(attendance);
    return attendance;
  });
}

export async function checkOut(employeeId: string, proof?: ClockProof): Promise<AttendanceRecord> {
  return withClockLock(employeeId, async () => {
    const open = await findOpenAttendance(employeeId);

    if (!open) {
      const today = await findTodayAttendance(employeeId);

      if (today?.checkOut) {
        throw new AppError(409, "You have already checked out today");
      }

      throw new AppError(404, "No open check-in found, check in first");
    }

    const verification = proof ? await verifyClockProof(employeeId, proof) : null;
    let attendance: AttendanceRecord | null;
    try {
      attendance = await checkOutEmployee(employeeId, verification);
      if (!attendance) throw new AppError(409, "You have already checked out");
    } catch (error) {
      discardSelfie(verification, "check-out rejected");
      throw error;
    }
    await invalidateAttendanceCaches(attendance);
    return attendance;
  });
}

export async function getMyTodayAttendance(
  employeeId: string,
): Promise<AttendanceRecord | null> {
  const today = await getLocalToday();
  const cacheKey = todayCacheKey(employeeId, today);
  const cached = await getCached<AttendanceRecord | null>(cacheKey);

  if (cached) {
    return cached;
  }

  const attendance = await findTodayAttendance(employeeId);

  if (attendance) {
    await setCached(cacheKey, attendance);
  }

  return attendance;
}

export async function listMyAttendances(
  employeeId: string,
  query: MyAttendanceQuery,
): Promise<AttendanceListResult> {
  return listAttendances({ ...query, employeeId });
}

export async function createAttendance(
  input: CreateAttendanceInput,
): Promise<AttendanceRecord> {
  assertNotFuture(input.checkIn, "checkIn");
  assertNotFuture(input.checkOut, "checkOut");
  assertSaneDuration(input.checkIn, input.checkOut);

  const status = input.status ?? deriveStatus(input.checkIn, input.checkOut);

  try {
    const attendance = await insertAttendance({ ...input, status });

    await invalidateAttendanceCaches(attendance);

    return attendance;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listAttendances(
  query: ListAttendancesQuery,
): Promise<AttendanceListResult> {
  const version = await getCacheVersion(ATTENDANCE_LIST_NAMESPACE);
  const cacheKey = attendanceListCacheKey(version, query);
  const cached = await getCached<AttendanceListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllAttendances(query);

  const result: AttendanceListResult = {
    attendances: rows,
    pagination: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
    },
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getAttendance(id: string): Promise<AttendanceRecord> {
  const cacheKey = attendanceCacheKey(id);
  const cached = await getCached<AttendanceRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const attendance = await findAttendanceById(id);

  if (!attendance) {
    throw new AppError(404, "Attendance record not found");
  }

  await setCached(cacheKey, attendance);

  return attendance;
}

export async function updateAttendance(
  id: string,
  input: UpdateAttendanceInput,
  actorId: string,
): Promise<AttendanceRecord> {
  const existing = await findAttendanceById(id);

  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }

  assertNotFuture(input.checkIn, "checkIn");
  assertNotFuture(input.checkOut, "checkOut");

  const nextCheckIn =
    input.checkIn !== undefined ? input.checkIn : existing.checkIn;
  const nextCheckOut =
    input.checkOut !== undefined ? input.checkOut : existing.checkOut;

  assertSaneDuration(nextCheckIn, nextCheckOut);

  const timesTouched =
    input.checkIn !== undefined || input.checkOut !== undefined;

  // An explicit status always wins; otherwise only re-derive when the manager
  // actually moved a timestamp, so editing overtime alone never flips status.
  const status =
    input.status ??
    (timesTouched ? deriveStatus(nextCheckIn, nextCheckOut) : undefined);

  try {
    const attendance = await updateAttendanceById(
      id,
      { ...input, status },
      actorId,
    );

    if (!attendance) {
      throw new AppError(404, "Attendance record not found");
    }

    await invalidateAttendanceCaches(existing);
    await invalidateAttendanceCaches(attendance);

    return attendance;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function removeAttendance(id: string): Promise<string> {
  const existing = await findAttendanceById(id);

  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }

  const deletedId = await deleteAttendanceById(id);

  if (!deletedId) {
    throw new AppError(404, "Attendance record not found");
  }

  discardSelfie(existing.checkInVerification, "attendance deleted");
  discardSelfie(existing.checkOutVerification, "attendance deleted");
  await invalidateAttendanceCaches(existing);

  return deletedId;
}

export async function markAbsentees(attendanceDate: string): Promise<number> {
  const inserted = await insertAbsentees(attendanceDate);

  if (inserted.length > 0) {
    await bumpCacheVersion(ATTENDANCE_LIST_NAMESPACE);
  }

  return inserted.length;
}

// --- Face and office proximity verification -------------------------------

const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
type FaceTemplate = { descriptor: number[]; source: FaceTemplateSource };
const pendingHrTemplates = new Map<string, Promise<FaceTemplate | null>>();
const unusableHrPhotos = new Map<string, number>();

function queueImageCleanup(publicId: string | null | undefined, reason: string): void {
  if (!publicId) return;
  void enqueueCloudinaryImageDeletion(publicId, reason).catch((error) => {
    logger.warn({ err: error }, "Could not queue attendance image cleanup");
  });
}

function discardSelfie(verification: AttendanceVerification | null, reason: string): void {
  queueImageCleanup(verification?.selfiePublicId, reason);
}

async function storeSelfie(image: Buffer, folder: string): Promise<StoredImage | null> {
  if (!env.attendanceStoreSelfies) return null;
  try {
    return await uploadImageToCloudinary(image, folder, { timeoutMs: 15_000 });
  } catch (error) {
    // Cloud storage is optional: an otherwise valid face match still records.
    logger.warn({ err: error }, "Attendance selfie could not be stored");
    return null;
  }
}

function assertSelfie(selfie: Buffer): void {
  if (!Buffer.isBuffer(selfie) || !selfie.length || selfie.length > MAX_SELFIE_BYTES) {
    throw new AppError(400, "Attach a selfie of 5 MB or smaller", "FACE_IMAGE_INVALID");
  }
  assertIsSupportedImage(selfie, "selfie");
}

/** HR profile images originate from our Cloudinary uploader, never arbitrary
 * remote URLs. Bound both transfer time and size before decoding the image. */
async function readHrPhoto(rawUrl: string): Promise<Buffer> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" ||
      url.username || url.password || url.port) {
    throw new AppError(400, "HR photo must be an uploaded profile image", "FACE_IMAGE_INVALID");
  }
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new AppError(400, "HR profile photo could not be read", "FACE_IMAGE_INVALID");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_SELFIE_BYTES) {
        throw new AppError(400, "HR photo must be 5 MB or smaller", "FACE_IMAGE_INVALID");
      }
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const image = Buffer.concat(chunks);
  assertSelfie(image);
  return image;
}

async function fetchHrPhoto(rawUrl: string): Promise<Buffer> {
  try {
    return await readHrPhoto(rawUrl);
  } catch (error) {
    if (error instanceof AppError) throw error;
    // An unavailable HR image must not block the employee's own enrollment
    // screen. Model/service errors occur outside this download-only fallback.
    throw new AppError(400, "HR profile photo could not be read; enroll a selfie instead", "FACE_IMAGE_INVALID");
  }
}

function storedTemplate(profile: VerificationProfile): FaceTemplate | null {
  return profile.faceDescriptor
    ? { descriptor: profile.faceDescriptor, source: profile.faceSource ?? "self" }
    : null;
}

/** Embed the HR image once, sharing concurrent requests. A self-enrolled
 * template always wins, including if enrollment happens while we infer. */
async function resolveFaceTemplate(profile: VerificationProfile): Promise<FaceTemplate | null> {
  const existing = storedTemplate(profile);
  if (existing) return existing;
  if (!profile.employeeImageUrl) return null;
  const key = `${profile.userId}:${profile.employeeImageUrl}`;
  if ((unusableHrPhotos.get(key) ?? 0) > Date.now()) return null;
  const pending = pendingHrTemplates.get(key);
  if (pending) return pending;
  const task = (async (): Promise<FaceTemplate | null> => {
    try {
      const image = await fetchHrPhoto(profile.employeeImageUrl!);
      const described = await describeFace(image);
      const saved = await saveFaceTemplate(profile.userId, described.descriptor, "hr_photo", null, profile.employeeImageUrl!);
      if (!saved) {
        const latest = await findVerificationProfile(profile.userId);
        return latest ? storedTemplate(latest) : null;
      }
      await invalidateEmployeeCaches(profile.userId);
      return { descriptor: described.descriptor, source: "hr_photo" };
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
      // Unusable HR photos should not cause repeated inference on every screen.
      if (unusableHrPhotos.size >= 256) unusableHrPhotos.delete(unusableHrPhotos.keys().next().value!);
      unusableHrPhotos.set(key, Date.now() + 60_000);
      logger.info({ userId: profile.userId, code: error.code }, "HR photo is not usable as a face template");
      return null;
    }
  })();
  pendingHrTemplates.set(key, task);
  try { return await task; } finally { pendingHrTemplates.delete(key); }
}

export function checkLocation(profile: VerificationProfile, proof: ClockProof): AttendanceVerification["location"] {
  const base = {
    latitude: proof.latitude,
    longitude: proof.longitude,
    accuracyM: proof.accuracyM,
    workLocation: profile.workLocation || null,
  };
  if (profile.workLatitude === null || profile.workLongitude === null) {
    return { ...base, status: "not_configured", distanceM: null, radiusM: null };
  }
  if (proof.accuracyM !== null && proof.accuracyM > env.locationMaxAccuracyM) {
    throw new AppError(422, `Your GPS fix is too imprecise (±${Math.round(proof.accuracyM)} m). Move to a clearer location and try again.`, "LOCATION_IMPRECISE");
  }
  const distanceM = distanceBetween(proof, { latitude: profile.workLatitude, longitude: profile.workLongitude });
  const allowance = Math.min(proof.accuracyM ?? 0, env.locationAccuracyAllowanceM);
  if (distanceM > profile.workRadiusM + allowance) {
    throw new AppError(422, `You're ${formatDistance(distanceM)} from ${profile.workLocation || "the office"}. You must be within ${profile.workRadiusM} m.`, "OUTSIDE_GEOFENCE");
  }
  return { ...base, status: "inside", distanceM: Math.round(distanceM), radiusM: profile.workRadiusM };
}

async function verifyClockProof(employeeId: string, proof: ClockProof): Promise<AttendanceVerification> {
  assertSelfie(proof.selfie);
  // Validate here too: service callers must not be able to bypass HTTP checks.
  const coordinatesValid = Number.isFinite(proof.latitude) && Math.abs(proof.latitude) <= 90 &&
    Number.isFinite(proof.longitude) && Math.abs(proof.longitude) <= 180;
  const accuracyValid = proof.accuracyM === null ||
    (Number.isFinite(proof.accuracyM) && proof.accuracyM >= 0 && proof.accuracyM <= 100_000);
  if (!coordinatesValid || !accuracyValid) throw new AppError(400, "Valid location coordinates are required", "LOCATION_REQUIRED");
  const profile = await findVerificationProfile(employeeId);
  if (!profile) throw new AppError(404, "HR has not created your employee profile yet", "PROFILE_MISSING");
  // Cheap location rejection precedes any HR-photo embedding, match or upload.
  const location = checkLocation(profile, proof);
  const template = await resolveFaceTemplate(profile);
  if (!template) throw new AppError(409, "Set up face check-in from your profile first", "FACE_NOT_ENROLLED");
  const described = await describeFace(proof.selfie);
  const distance = faceDistance(described.descriptor, template.descriptor);
  if (!Number.isFinite(distance) || distance > env.faceMatchThreshold) {
    throw new AppError(422, "This selfie does not match your enrolled face. Try better light or update your face from your profile.", "FACE_MISMATCH");
  }
  const stored = await storeSelfie(proof.selfie, "peoplepay360/attendance");
  return {
    verifiedAt: new Date().toISOString(),
    selfieUrl: stored?.url ?? null,
    selfiePublicId: stored?.publicId ?? null,
    face: { status: "matched", distance: Math.round(distance * 1000) / 1000, threshold: env.faceMatchThreshold, source: template.source },
    location,
  };
}

function verificationStatus(profile: VerificationProfile | null): VerificationStatus {
  return {
    face: {
      enrolled: Boolean(profile?.faceDescriptor),
      source: profile?.faceDescriptor ? profile.faceSource ?? "self" : null,
      enrolledAt: profile?.faceEnrolledAt?.toISOString() ?? null,
      imageUrl: profile?.faceImageUrl ?? null,
    },
    office: {
      configured: profile?.workLatitude != null && profile.workLongitude != null,
      name: profile?.workLocation || null,
      latitude: profile?.workLatitude ?? null,
      longitude: profile?.workLongitude ?? null,
      radiusM: profile?.workRadiusM ?? null,
    },
    thresholds: { faceDistance: env.faceMatchThreshold, accuracyAllowanceM: env.locationAccuracyAllowanceM },
  };
}

export async function getVerificationStatus(employeeId: string): Promise<VerificationStatus> {
  let profile = await findVerificationProfile(employeeId);
  if (profile && !profile.faceDescriptor && await resolveFaceTemplate(profile)) {
    profile = await findVerificationProfile(employeeId);
  }
  return verificationStatus(profile);
}

export async function enrollFace(employeeId: string, selfie: Buffer): Promise<VerificationStatus> {
  assertSelfie(selfie);
  const profile = await findVerificationProfile(employeeId);
  if (!profile) throw new AppError(404, "HR has not created your employee profile yet, so face check-in cannot be set up", "PROFILE_MISSING");
  const described = await describeFace(selfie);
  const image = await storeSelfie(selfie, "peoplepay360/faces");
  let saved: Awaited<ReturnType<typeof saveFaceTemplate>>;
  try {
    saved = await saveFaceTemplate(employeeId, described.descriptor, "self", image);
    if (!saved) throw new AppError(404, "Your employee profile no longer exists", "PROFILE_MISSING");
  } catch (error) {
    queueImageCleanup(image?.publicId, "face enrollment failed");
    throw error;
  }
  queueImageCleanup(saved.previousImagePublicId, "face template replaced");
  await invalidateEmployeeCaches(employeeId);
  return verificationStatus(await findVerificationProfile(employeeId));
}
