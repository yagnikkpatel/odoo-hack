export const ATTENDANCE_STATUSES = ["present", "absent", "incomplete"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";

export const OPEN_SESSION_MAX_HOURS = 24;

export type FaceTemplateSource = "self" | "hr_photo";

/** Only passing proof is persisted; absent geofences are explicitly unverified. */
export type AttendanceVerification = {
  verifiedAt: string;
  selfieUrl: string | null;
  selfiePublicId: string | null;
  face: {
    status: "matched";
    distance: number;
    threshold: number;
    source: FaceTemplateSource;
  };
  location: {
    status: "inside" | "not_configured";
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    distanceM: number | null;
    radiusM: number | null;
    workLocation: string | null;
  };
};

export type VerificationStatus = {
  face: {
    enrolled: boolean;
    source: FaceTemplateSource | null;
    enrolledAt: string | null;
    imageUrl: string | null;
  };
  office: {
    configured: boolean;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    radiusM: number | null;
  };
  thresholds: { faceDistance: number; accuracyAllowanceM: number };
};

export type ClockProof = {
  selfie: Buffer;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  attendanceDate: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workedHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  checkInVerification: AttendanceVerification | null;
  checkOutVerification: AttendanceVerification | null;
  editedBy: string | null;
  editedByName: string | null;
  editedAt: Date | null;
  editReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceListResult = {
  attendances: AttendanceRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};
