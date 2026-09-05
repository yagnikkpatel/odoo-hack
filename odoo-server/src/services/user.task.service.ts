import { AppError } from "../errors/AppError";
import {
  createTask,
  deleteTask,
  fetchTaskByUserId,
  findTaskByIdAndUserId,
  updateTaskTitle,
} from "../repositories/user.task.repository";
import { Task } from "../types/task";

function validateTitle(title: unknown): string {
  if (typeof title !== "string" || !title.trim()) {
    throw new AppError(400, "Title is required");
  }

  const trimmedTitle = title.trim();

  if (trimmedTitle.length > 100) {
    throw new AppError(400, "Title must be 100 char or less");
  }

  return trimmedTitle;
}

export async function createUserTask(
  userId: string,
  title: unknown,
): Promise<Task> {
  const validTitle = validateTitle(title);
  return createTask(userId, validTitle);
}

export async function getUserTasks(userId: string): Promise<Task[]> {
  return fetchTaskByUserId(userId);
}

export async function getUserTaskById(
  taskId: string,
  userId: string,
): Promise<Task> {
  const task = await findTaskByIdAndUserId(taskId, userId);

  if (!task) {
    throw new AppError(404, "Task not found");
  }

  return task;
}

export async function updateUserTask(
  taskId: string,
  userId: string,
  title: string,
): Promise<Task | null> {
  const validTitle = validateTitle(title);
  const task = updateTaskTitle(taskId, userId, validTitle);

  if (!task) {
    throw new AppError(404, "Task not found");
  }

  return task;
}

export async function deleteUserTask(
  taskId: string,
  userId: string,
): Promise<void> {
  const deleted = await deleteTask(taskId, userId);

  if (!deleted) {
    throw new AppError(404, "Task not found");
  }
}
