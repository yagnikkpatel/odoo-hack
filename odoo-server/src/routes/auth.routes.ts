import { Router } from "express";
import {
  loginUser,
  loginWithGoogle,
  registerUser,
  startGoogleLogin,
} from "../services/auth.service";
import { authenticate } from "../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // not writing service login here
    // service login - servicefile
    await registerUser(email, password);

    res.status(201).json({
      succes: true,
      message: "Registration successfull. Please login to continue",
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { accessToken } = await loginUser(email, password);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// get my current user information
// protect your routes

authRouter.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

// /api/auth/google
// google consent screen

authRouter.get("/google", (_req, res) => {
  const googleAuthUrl = startGoogleLogin();
  res.redirect(googleAuthUrl);
});

authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const code = req.query.code as string | undefined;

    const { accessToken } = await loginWithGoogle(code ?? "");

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
});
