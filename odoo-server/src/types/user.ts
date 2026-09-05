export type UserRole =
  | "admin"
  | "employee"
  | "hr_manager"
  | "hr_payroll_user"
  | "hr_payroll_manager";

export type UserStatus = "active" | "inactive";

export type TokenPayload = {
  userId: string;
  email: string;
  role: UserRole;
};

// Refresh tokens carry a session id so they can be rotated and revoked
// server-side, and a `type` claim so an access token can never be replayed
// on the refresh endpoint.
export type RefreshTokenPayload = TokenPayload & {
  sessionId: string;
  type: "refresh";
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
};

export type UserAuthRecord = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password_hash: string;
};
