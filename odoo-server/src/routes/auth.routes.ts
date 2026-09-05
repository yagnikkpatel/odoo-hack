import { Router } from "express";
import {
  currentUserHandler,
  forgotPasswordHandler,
  loginHandler,
  resetPasswordHandler,
  verifyOtpHandler,
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.get("/me", requireAuth, currentUserHandler);

authRouter.post("/login", loginHandler);
authRouter.post("/forgot-password", forgotPasswordHandler);
authRouter.post("/verify-otp", verifyOtpHandler);
authRouter.post("/reset-password", resetPasswordHandler);
