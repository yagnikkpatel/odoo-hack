import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import * as authService from "../services/auth.service";

export const authRouter = Router();

authRouter.post("/auth/login", async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await authService.login(req.body) });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/auth/me", authenticate, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await authService.getSession(req.user!.userId),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/auth/change-password", authenticate, async (req, res, next) => {
  try {
    await authService.changePassword(req.user!.userId, req.body);

    res.status(200).json({ success: true, message: "Password updated." });
  } catch (err) {
    next(err);
  }
});
