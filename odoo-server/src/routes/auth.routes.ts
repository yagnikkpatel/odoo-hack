import { Router } from "express";
import {
  forgotPasswordHandler,
  loginHandler,
  resetPasswordHandler,
  verifyOtpHandler,
} from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", loginHandler);
authRouter.post("/forgot-password", forgotPasswordHandler);
authRouter.post("/verify-otp", verifyOtpHandler);
authRouter.post("/reset-password", resetPasswordHandler);
