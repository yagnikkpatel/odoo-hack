import { Router } from "express";
import { loginHandler } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", loginHandler);
