export const FACE_RETAKE_CODES = new Set([
  "FACE_MISMATCH", "NO_FACE", "FACE_NOT_DETECTED", "MULTIPLE_FACES",
  "FACE_IMAGE_INVALID", "SELFIE_REQUIRED",
]);

export function captureFailureLabel(code: string | null): string {
  if (code === "FACE_MISMATCH") return "Face didn’t match";
  if (code === "MULTIPLE_FACES") return "Only one face, please";
  if (code && FACE_RETAKE_CODES.has(code)) return "Try a clearer selfie";
  if (code === "OUTSIDE_GEOFENCE") return "Outside the office area";
  if (code?.startsWith("LOCATION_")) return "Couldn’t confirm location";
  // Network/setup failures say nothing about the quality of the photo.
  return "Couldn’t complete verification";
}
