export const BACKEND_ROLES = ['admin', 'employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'] as const
export type BackendRole = (typeof BACKEND_ROLES)[number]
export type SessionUser = { id: string; email: string; role: BackendRole; name?: string }
export type LoginInput = { email: string; password: string; rememberMe: boolean }
export type PasswordResetInput = { newPassword: string; confirmPassword: string }
