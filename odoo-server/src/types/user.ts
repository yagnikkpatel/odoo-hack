export type RoleName =
  | "employee"
  | "hr_manager"
  | "hr_payroll_user"
  | "hr_payroll_manager"
  | "admin";

export type PermissionModule =
  | "employee"
  | "contract"
  | "attendance"
  | "time_off"
  | "payroll"
  | "config"
  | "admin";

export type TokenPayload = {
  userId: string;
  email: string;
  role: RoleName;
  employeeId: string | null;
};

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserWithRoleRow = Omit<UserRow, "password_hash"> & {
  role_name: RoleName;
  role_label: string;
  employee_id: string | null;
};

export type RoleRow = {
  id: string;
  name: RoleName;
  label: string;
  permission_count?: string;
  user_count?: string;
};

export type PermissionRow = {
  id: string;
  code: string;
  module: PermissionModule;
  description: string;
};
