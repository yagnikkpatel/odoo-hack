import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from "../controllers/user.controller";

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.post("/", requirePermission("user:create"), createUserHandler);
userRouter.get("/", requirePermission("user:read"), listUsersHandler);
userRouter.get("/:id", requirePermission("user:read"), getUserHandler);
userRouter.patch("/:id", requirePermission("user:update"), updateUserHandler);
userRouter.delete("/:id", requirePermission("user:delete"), deleteUserHandler);
