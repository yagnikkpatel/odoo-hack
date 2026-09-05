import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../types/user.dto";
import {
  login,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from "../services/auth.service";

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
