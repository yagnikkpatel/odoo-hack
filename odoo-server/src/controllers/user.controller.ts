import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../types/user.dto";
import {
  createUser,
  getUserById,
  listUsers,
  removeUserById,
  updateUserById,
} from "../services/user.service";

export async function createUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createUserSchema, req.body);
  const user = await createUser(input);

  res.status(201).json({
    success: true,
    data: user,
  });
}

export async function listUsersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const users = await listUsers();

  res.status(200).json({
    success: true,
    data: users,
  });
}

export async function getUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(userIdParamSchema, req.params);
  const user = await getUserById(id);

  res.status(200).json({
    success: true,
    data: user,
  });
}

export async function updateUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(userIdParamSchema, req.params);
  const input = parseOrThrow(updateUserSchema, req.body);
  const user = await updateUserById(id, input);

  res.status(200).json({
    success: true,
    data: user,
  });
}

export async function deleteUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(userIdParamSchema, req.params);
  const deletedId = await removeUserById(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}
