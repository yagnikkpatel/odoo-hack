import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import {
  createEmployeeProfileSchema,
  imageParamSchema,
  listEmployeesQuerySchema,
  updateEmployeeProfileSchema,
  userIdParamSchema,
} from "../types/employee.dto";
import {
  createEmployeeProfile,
  getEmployeeProfile,
  listEmployeeProfiles,
  listManagerOptions,
  removeEmployeeImage,
  removeEmployeeProfile,
  updateEmployeeImages,
  updateEmployeeProfile,
  ProfileImageUploads,
} from "../services/employee.service";

function extractImages(req: Request): ProfileImageUploads {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  return {
    employeeImage: files?.employeeImage?.[0]?.buffer ?? null,
    companyImage: files?.companyImage?.[0]?.buffer ?? null,
  };
}

export async function listManagersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const managers = await listManagerOptions();

  res.status(200).json({
    success: true,
    data: managers,
  });
}

export async function listEmployeesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listEmployeesQuerySchema, req.query);
  const result = await listEmployeeProfiles(query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function createEmployeeProfileHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = parseOrThrow(userIdParamSchema, req.params);
  const input = parseOrThrow(createEmployeeProfileSchema, req.body);
  const profile = await createEmployeeProfile(userId, input);

  res.status(201).json({
    success: true,
    data: profile,
  });
}

export async function getEmployeeProfileHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = parseOrThrow(userIdParamSchema, req.params);
  const profile = await getEmployeeProfile(userId);

  res.status(200).json({
    success: true,
    data: profile,
  });
}

export async function updateEmployeeProfileHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = parseOrThrow(userIdParamSchema, req.params);
  const input = parseOrThrow(updateEmployeeProfileSchema, req.body);
  const profile = await updateEmployeeProfile(userId, input);

  res.status(200).json({
    success: true,
    data: profile,
  });
}

export async function uploadEmployeeImagesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = parseOrThrow(userIdParamSchema, req.params);
  const images = await updateEmployeeImages(userId, extractImages(req));

  res.status(200).json({
    success: true,
    data: {
      userId,
      ...images,
    },
  });
}

export async function deleteEmployeeImageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId, imageType } = parseOrThrow(imageParamSchema, req.params);
  const images = await removeEmployeeImage(userId, imageType);

  res.status(200).json({
    success: true,
    message: `${imageType} image deleted`,
    data: {
      userId,
      ...images,
    },
  });
}

export async function deleteEmployeeProfileHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = parseOrThrow(userIdParamSchema, req.params);

  await removeEmployeeProfile(userId);

  res.status(200).json({
    success: true,
    message: "Employee profile deleted",
  });
}
