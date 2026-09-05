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
