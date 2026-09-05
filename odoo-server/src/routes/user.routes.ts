import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from "../controllers/user.controller";

export const userRouter = Router();

userRouter.use(requireAuth, requireAdmin);

userRouter.post("/", createUserHandler);
userRouter.get("/", listUsersHandler);
userRouter.get("/:id", getUserHandler);
userRouter.patch("/:id", updateUserHandler);
userRouter.delete("/:id", deleteUserHandler);
