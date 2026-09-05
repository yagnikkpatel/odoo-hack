import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { getCurrentAuthUser } from "../services/current-auth-user.service";
import { getRolePermissions } from "../services/permission.service";
import { parseOrThrow } from "../lib/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../types/user.dto";
import {
  login,
  logout,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from "../services/auth.service";

export async function currentUserHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.userId) throw new AppError(401, "Authentication is required");
  const user = await getCurrentAuthUser(req.user.userId);
  const permissions = [...await getRolePermissions(user.role)];
  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({ success: true, data: { user: { ...user, permissions } } });
}

export async function loginHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(loginSchema, req.body);
  const result = await login(input);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function refreshHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(refreshTokenSchema, req.body);
  const result = await refreshSession(input);

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function logoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(refreshTokenSchema, req.body);

  await logout(input);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(forgotPasswordSchema, req.body);

  await requestPasswordReset(input);

  res.status(200).json({
    success: true,
    message: "If the email is registered, an OTP has been sent",
  });
}

export async function verifyOtpHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(verifyOtpSchema, req.body);
  const result = await verifyPasswordResetOtp(input);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(resetPasswordSchema, req.body);

  await resetPassword(input);

  res.status(200).json({
    success: true,
    message: "Password has been reset successfully",
  });
}
