import type { VerificationStatus } from "./types";
export function templateLabel(face: VerificationStatus["face"]) {
  if (!face.enrolled) return "Not enrolled";
  return face.source === "hr_photo" ? "Enrolled · HR photo" : `Enrolled${face.enrolledAt ? " " + new Date(face.enrolledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""} · your selfie`;
}
export function officeLabel(office: VerificationStatus["office"]) {
  return office.configured ? `${office.name ?? "Office"} · within ${office.radiusM} m` : "Not set by HR. Your location is recorded but not checked.";
}
