import { AppError } from "../errors/AppError";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { assertIsSupportedImage } from "../lib/imageValidation";
import { enqueueCloudinaryImageDeletion } from "../queues/deleteCloudinaryImage.queue";
import {
  clearProfileImage,
  deleteProfileByUserId,
  findAllProfiles,
  findManagerOptions,
  findManagerRole,
  findProfileByUserId,
  insertProfile,
  updateProfile,
} from "../repositories/employee.repository";
import {
  CreateEmployeeProfileInput,
  ImageType,
  ListEmployeesQuery,
  UpdateEmployeeProfileInput,
} from "../types/employee.dto";
import {
  EmployeeImages,
  EmployeeListResult,
  EmployeeProfileRecord,
  MANAGER_ROLES,
  ManagerOption,
  StoredImage,
} from "../types/employee";

const EMPLOYEE_IMAGE_FOLDER = "peoplepay360/employees";
const COMPANY_IMAGE_FOLDER = "peoplepay360/companies";
const EMPLOYEE_LIST_NAMESPACE = "employee-list";

export type ProfileImageUploads = {
  employeeImage: Buffer | null;
  companyImage: Buffer | null;
};

function profileCacheKey(userId: string): string {
  return `employee-profile:${userId}`;
}

function employeeListCacheKey(
  version: number,
  query: ListEmployeesQuery,
): string {
  const parts = [
    `limit=${query.limit}`,
    `offset=${query.offset}`,
    `department=${query.department ?? ""}`,
    `role=${query.role ?? ""}`,
    `search=${query.search ?? ""}`,
  ];

  return `${EMPLOYEE_LIST_NAMESPACE}:v${version}:${parts.join("&")}`;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function isUniqueViolation(error: unknown): boolean {
  return getErrorCode(error) === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return getErrorCode(error) === "23503";
}

function isCheckViolation(error: unknown): boolean {
  return getErrorCode(error) === "23514";
}

async function assertManagerIsSelectable(
  managerId: string | undefined,
  userId: string,
): Promise<void> {
  if (!managerId) {
    return;
  }

  if (managerId === userId) {
    throw new AppError(400, "An employee cannot be their own manager");
  }

  const role = await findManagerRole(managerId);

  if (!role) {
    throw new AppError(400, "Manager not found");
  }

  if (!MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number])) {
    throw new AppError(
      400,
      `Selected user is not a manager, expected one of ${MANAGER_ROLES.join(", ")}`,
    );
  }
}

async function invalidateEmployeeCaches(userId: string): Promise<void> {
  await invalidateCache([profileCacheKey(userId)]);
  await bumpCacheVersion(EMPLOYEE_LIST_NAMESPACE);
}

export async function listManagerOptions(): Promise<ManagerOption[]> {
  return findManagerOptions(MANAGER_ROLES);
}

export async function createEmployeeProfile(
  userId: string,
  input: CreateEmployeeProfileInput,
): Promise<EmployeeProfileRecord> {
  await assertManagerIsSelectable(input.managerId, userId);

  try {
    const profile = await insertProfile({ userId, fields: input });

    await invalidateEmployeeCaches(userId);

    return profile;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Employee profile already exists for this user");
    }

    if (isForeignKeyViolation(error)) {
      throw new AppError(404, "User not found");
    }

    if (isCheckViolation(error)) {
      throw new AppError(400, "An employee cannot be their own manager");
    }

    throw error;
  }
}

export async function listEmployeeProfiles(
  query: ListEmployeesQuery,
): Promise<EmployeeListResult> {
  const version = await getCacheVersion(EMPLOYEE_LIST_NAMESPACE);
  const cacheKey = employeeListCacheKey(version, query);
  const cached = await getCached<EmployeeListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllProfiles(query);

  const result: EmployeeListResult = {
    employees: rows,
    pagination: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
    },
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getEmployeeProfile(
  userId: string,
): Promise<EmployeeProfileRecord> {
  const cacheKey = profileCacheKey(userId);
  const cached = await getCached<EmployeeProfileRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const profile = await findProfileByUserId(userId);

  if (!profile) {
    throw new AppError(404, "Employee profile not found");
  }

  await setCached(cacheKey, profile);

  return profile;
}

export async function updateEmployeeProfile(
  userId: string,
  input: UpdateEmployeeProfileInput,
): Promise<EmployeeProfileRecord> {
  await assertManagerIsSelectable(input.managerId, userId);

  try {
    const updated = await updateProfile(userId, input, null, null);

    if (!updated) {
      throw new AppError(404, "Employee profile not found");
    }

    await invalidateEmployeeCaches(userId);

    return updated.profile;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isCheckViolation(error)) {
      throw new AppError(400, "An employee cannot be their own manager");
    }

    throw error;
  }
}

export async function updateEmployeeImages(
  userId: string,
  uploads: ProfileImageUploads,
): Promise<EmployeeImages> {
  if (!uploads.employeeImage && !uploads.companyImage) {
    throw new AppError(
      400,
      "Provide at least one of employeeImage or companyImage",
    );
  }

  if (uploads.employeeImage) {
    assertIsSupportedImage(uploads.employeeImage, "employeeImage");
  }

  if (uploads.companyImage) {
    assertIsSupportedImage(uploads.companyImage, "companyImage");
  }

  const existing = await findProfileByUserId(userId);

  if (!existing) {
    throw new AppError(404, "Employee profile not found");
  }

  const [employeeImage, companyImage] = await Promise.all([
    uploads.employeeImage
      ? uploadImageToCloudinary(uploads.employeeImage, EMPLOYEE_IMAGE_FOLDER)
      : Promise.resolve<StoredImage | null>(null),
    uploads.companyImage
      ? uploadImageToCloudinary(uploads.companyImage, COMPANY_IMAGE_FOLDER)
      : Promise.resolve<StoredImage | null>(null),
  ]);

  try {
    const updated = await updateProfile(userId, {}, employeeImage, companyImage);

    if (!updated) {
      throw new AppError(404, "Employee profile not found");
    }

    if (employeeImage) {
      await enqueueCloudinaryImageDeletion(
        updated.previousImages.employeeImagePublicId,
        "employee image replaced",
      );
    }

    if (companyImage) {
      await enqueueCloudinaryImageDeletion(
        updated.previousImages.companyImagePublicId,
        "company image replaced",
      );
    }

    await invalidateEmployeeCaches(userId);

    return {
      ...(updated.profile.employeeImage
        ? { employeeImage: updated.profile.employeeImage }
        : {}),
      ...(updated.profile.companyImage
        ? { companyImage: updated.profile.companyImage }
        : {}),
    };
  } catch (error) {
    await enqueueCloudinaryImageDeletion(
      employeeImage?.publicId,
      "rollback of failed employee image upload",
    );
    await enqueueCloudinaryImageDeletion(
      companyImage?.publicId,
      "rollback of failed employee image upload",
    );

    throw error;
  }
}

export async function removeEmployeeImage(
  userId: string,
  imageType: ImageType,
): Promise<EmployeeImages> {
  const result = await clearProfileImage(userId, imageType);

  if (!result) {
    throw new AppError(404, "Employee profile not found");
  }

  if (!result.removedPublicId) {
    throw new AppError(404, `No ${imageType} image to delete`);
  }

  await enqueueCloudinaryImageDeletion(
    result.removedPublicId,
    `${imageType} image deleted`,
  );

  await invalidateEmployeeCaches(userId);

  return {
    ...(result.profile.employeeImage
      ? { employeeImage: result.profile.employeeImage }
      : {}),
    ...(result.profile.companyImage
      ? { companyImage: result.profile.companyImage }
      : {}),
  };
}

export async function removeEmployeeProfile(userId: string): Promise<void> {
  const images = await deleteProfileByUserId(userId);

  if (!images) {
    throw new AppError(404, "Employee profile not found");
  }

  await enqueueCloudinaryImageDeletion(
    images.employeeImagePublicId,
    "employee profile deleted",
  );
  await enqueueCloudinaryImageDeletion(
    images.companyImagePublicId,
    "employee profile deleted",
  );

  await invalidateEmployeeCaches(userId);
}
