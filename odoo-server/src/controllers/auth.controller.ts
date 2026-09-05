import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import { loginSchema } from "../types/user.dto";
import { login } from "../services/auth.service";

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
