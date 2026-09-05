import { PoolClient } from "pg";
import { pool } from "../lib/db";
import type { FaceTemplateSource } from "../types/attendance";
import {
  EmployeeProfileImageIds,
  EmployeeAccountOption,
  EmployeeDirectorySummary,
  EmployeeProfileRecord,
  ManagerOption,
  StoredImage,
} from "../types/employee";

type ProfileRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  jobPosition: string;
  contact: string;
  employeeImageUrl: string | null;
  employeeImageId: string | null;
  department: string;
  managerId: string | null;
  managerName: string | null;
  workingSchedule: string;
  company: string;
  companyImageUrl: string | null;
  companyImageId: string | null;
  workLocation: string;
  location: string | null;
  workLatitude: number | null;
  workLongitude: number | null;
  workRadiusM: number;
  faceEnrolledAt: Date | null;
  faceSource: FaceTemplateSource | null;
  createdAt: Date;
  updatedAt: Date;
};

const PROFILE_COLUMNS = `
    p.user_id AS "userId",
    u.name AS "name",
    u.email AS "email",
    ur.name AS "role",
    u.status AS "status",
    p.job_position AS "jobPosition",
    p.contact AS "contact",
    p.employee_image_url AS "employeeImageUrl",
    p.employee_image_public_id AS "employeeImageId",
    p.department AS "department",
    p.manager_id AS "managerId",
    m.name AS "managerName",
    p.working_schedule AS "workingSchedule",
    p.company_name AS "company",
    p.company_image_url AS "companyImageUrl",
    p.company_image_public_id AS "companyImageId",
    p.work_location AS "workLocation",
    p.location AS "location",
    p.work_latitude AS "workLatitude",
    p.work_longitude AS "workLongitude",
    p.work_radius_m AS "workRadiusM",
    p.face_enrolled_at AS "faceEnrolledAt",
    p.face_source AS "faceSource",
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt"
`;

const PROFILE_FROM = `
  FROM employee_profiles p
  JOIN users u ON u.id = p.user_id
  JOIN roles ur ON ur.id = u.role_id
  LEFT JOIN users m ON m.id = p.manager_id
`;

const PROFILE_SELECT = `SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM}`;

const UPDATABLE_COLUMNS: Record<string, string> = {
  jobPosition: "job_position",
  department: "department",
  contact: "contact",
  managerId: "manager_id",
  workingSchedule: "working_schedule",
  companyName: "company_name",
  workLocation: "work_location",
  location: "location",
  workLatitude: "work_latitude",
  workLongitude: "work_longitude",
  workRadiusM: "work_radius_m",
};

export type ProfileFields = {
  jobPosition?: string;
  department?: string;
  contact?: string;
  managerId?: string | null;
  workingSchedule?: string;
  companyName?: string;
  workLocation?: string;
  location?: string | null;
  workLatitude?: number | null;
  workLongitude?: number | null;
  workRadiusM?: number;
};

/** Internal verification data; never included in employee API responses. */
export type VerificationProfile = {
  userId: string;
  workLocation: string;
  workLatitude: number | null;
  workLongitude: number | null;
  workRadiusM: number;
  faceDescriptor: number[] | null;
  faceSource: FaceTemplateSource | null;
  faceImageUrl: string | null;
  faceEnrolledAt: Date | null;
  employeeImageUrl: string | null;
};

type ImageIdRow = {
  employee_image_public_id: string | null;
  company_image_public_id: string | null;
};

function toProfileRecord(row: ProfileRow): EmployeeProfileRecord {
  const employeeImage =
    row.employeeImageId && row.employeeImageUrl
      ? { imageId: row.employeeImageId, imageUrl: row.employeeImageUrl }
      : undefined;

  const companyImage =
    row.companyImageId && row.companyImageUrl
      ? { imageId: row.companyImageId, imageUrl: row.companyImageUrl }
      : undefined;

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    jobPosition: row.jobPosition,
    contact: row.contact,
    ...(employeeImage ? { employeeImage } : {}),
    department: row.department,
    managerId: row.managerId,
    managerName: row.managerName,
    workingSchedule: row.workingSchedule,
    company: row.company,
    ...(companyImage ? { companyImage } : {}),
    workLocation: row.workLocation,
    location: row.location,
    workLatitude: row.workLatitude,
    workLongitude: row.workLongitude,
    workRadiusM: row.workRadiusM,
    faceEnrolledAt: row.faceEnrolledAt,
    faceSource: row.faceSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findManagerOptions(
  roles: readonly string[],
): Promise<ManagerOption[]> {
  const result = await pool.query<ManagerOption>(
    `SELECT u.id, u.name, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = ANY($1) AND u.status = 'active'
     ORDER BY u.name`,
    [roles],
  );

  return result.rows;
}

export async function findEligibleEmployeeAccounts(): Promise<EmployeeAccountOption[]> {
  const result = await pool.query<EmployeeAccountOption>(
    `SELECT u.id, u.name, u.email, r.name AS role, u.status
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM employee_profiles p WHERE p.user_id = u.id)
     ORDER BY u.name, u.id`,
  );
  return result.rows;
}

export async function findManagerRole(
  managerId: string,
): Promise<string | null> {
  const result = await pool.query<{ role: string }>(
    `SELECT r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.status = 'active'`,
    [managerId],
  );

  return result.rows[0]?.role ?? null;
}

export async function findProfileByUserId(
  userId: string,
): Promise<EmployeeProfileRecord | null> {
  const result = await pool.query<ProfileRow>(
    `${PROFILE_SELECT} WHERE p.user_id = $1`,
    [userId],
  );

  const row = result.rows[0];

  return row ? toProfileRecord(row) : null;
}

export async function findAllProfiles(query: {
  limit: number;
  offset: number;
  department?: string;
  role?: string;
  search?: string;
}): Promise<{
  rows: EmployeeProfileRecord[];
  total: number;
  summary: EmployeeDirectorySummary;
}> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.department) {
    values.push(`%${query.department}%`);
    conditions.push(`p.department ILIKE $${values.length}`);
  }

  if (query.role) {
    values.push(query.role);
    conditions.push(`ur.name = $${values.length}`);
  }

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR p.job_position ILIKE $${values.length})`,
    );
  }

  let where = "";
  if (conditions.length > 0) {
    where = `WHERE ${conditions.join(" AND ")}`;
  }

  const filterValues = [...values];

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const [result, count, directory] = await Promise.all([
    pool.query<ProfileRow>(
      `SELECT ${PROFILE_COLUMNS}
       ${PROFILE_FROM}
       ${where}
       ORDER BY u.name, p.user_id
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      values,
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total ${PROFILE_FROM} ${where}`,
      filterValues,
    ),
    pool.query<EmployeeDirectorySummary>(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE u.status = 'active')::int AS active,
         COUNT(DISTINCT p.department)::int AS departments,
         COUNT(DISTINCT p.work_location)::int AS locations,
         COUNT(*) FILTER (WHERE p.manager_id IS NOT NULL)::int AS "withManager",
         COUNT(*) FILTER (WHERE p.manager_id IS NULL)::int AS "withoutManager"
       ${PROFILE_FROM}`,
    ),
  ]);

  return {
    rows: result.rows.map(toProfileRecord),
    total: count.rows[0].total,
    summary: directory.rows[0],
  };
}

export async function insertProfile(input: {
  userId: string;
  fields: Required<
    Pick<
      ProfileFields,
      | "jobPosition"
      | "department"
      | "contact"
      | "workingSchedule"
      | "companyName"
      | "workLocation"
    >
  > &
    Pick<ProfileFields, "managerId" | "location" | "workLatitude" | "workLongitude" | "workRadiusM">;
}): Promise<EmployeeProfileRecord> {
  await pool.query(
    `INSERT INTO employee_profiles (
       user_id, job_position, department, contact, manager_id,
       working_schedule, company_name, work_location, location,
       work_latitude, work_longitude, work_radius_m
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.userId,
      input.fields.jobPosition,
      input.fields.department,
      input.fields.contact,
      input.fields.managerId ?? null,
      input.fields.workingSchedule,
      input.fields.companyName,
      input.fields.workLocation,
      input.fields.location ?? null,
      input.fields.workLatitude ?? null,
      input.fields.workLongitude ?? null,
      input.fields.workRadiusM ?? 150,
    ],
  );

  const result = await pool.query<ProfileRow>(
    `${PROFILE_SELECT} WHERE p.user_id = $1`,
    [input.userId],
  );

  return toProfileRecord(result.rows[0]);
}

async function lockProfileImages(
  client: PoolClient,
  userId: string,
): Promise<EmployeeProfileImageIds | null> {
  const result = await client.query<ImageIdRow>(
    `SELECT employee_image_public_id, company_image_public_id
     FROM employee_profiles
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    employeeImagePublicId: row.employee_image_public_id,
    companyImagePublicId: row.company_image_public_id,
  };
}

export async function updateProfile(
  userId: string,
  fields: ProfileFields,
  employeeImage: StoredImage | null,
  companyImage: StoredImage | null,
): Promise<{
  profile: EmployeeProfileRecord;
  previousImages: EmployeeProfileImageIds;
} | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const previousImages = await lockProfileImages(client, userId);

    if (!previousImages) {
      await client.query("ROLLBACK");

      return null;
    }

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = fields[key as keyof ProfileFields];

      if (value !== undefined) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    if (employeeImage) {
      values.push(employeeImage.url);
      assignments.push(`employee_image_url = $${values.length}`);
      values.push(employeeImage.publicId);
      assignments.push(`employee_image_public_id = $${values.length}`);
      // Invalidate only an HR-photo-derived template, atomically with its photo.
      // Employee-enrolled selfies remain valid when HR replaces the avatar.
      for (const column of ["face_descriptor", "face_source", "face_image_url", "face_image_public_id", "face_enrolled_at"]) {
        assignments.push(`${column} = CASE WHEN face_source = 'hr_photo' THEN NULL ELSE ${column} END`);
      }
    }

    if (companyImage) {
      values.push(companyImage.url);
      assignments.push(`company_image_url = $${values.length}`);
      values.push(companyImage.publicId);
      assignments.push(`company_image_public_id = $${values.length}`);
    }

    assignments.push("updated_at = NOW()");
    values.push(userId);

    await client.query(
      `UPDATE employee_profiles
       SET ${assignments.join(", ")}
       WHERE user_id = $${values.length}`,
      values,
    );

    const result = await client.query<ProfileRow>(
      `${PROFILE_SELECT} WHERE p.user_id = $1`,
      [userId],
    );

    await client.query("COMMIT");

    return {
      profile: toProfileRecord(result.rows[0]),
      previousImages,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProfileByUserId(
  userId: string,
): Promise<EmployeeProfileImageIds | null> {
  const result = await pool.query<ImageIdRow>(
    `DELETE FROM employee_profiles
     WHERE user_id = $1
     RETURNING employee_image_public_id, company_image_public_id`,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    employeeImagePublicId: row.employee_image_public_id,
    companyImagePublicId: row.company_image_public_id,
  };
}

const IMAGE_COLUMNS: Record<string, { url: string; publicId: string }> = {
  employee: {
    url: "employee_image_url",
    publicId: "employee_image_public_id",
  },
  company: {
    url: "company_image_url",
    publicId: "company_image_public_id",
  },
};

export async function findVerificationProfile(userId: string): Promise<VerificationProfile | null> {
  const result = await pool.query<VerificationProfile>(
    `SELECT user_id AS "userId", work_location AS "workLocation",
       work_latitude AS "workLatitude", work_longitude AS "workLongitude",
       work_radius_m AS "workRadiusM", face_descriptor AS "faceDescriptor",
       face_source AS "faceSource", face_image_url AS "faceImageUrl",
       face_enrolled_at AS "faceEnrolledAt", employee_image_url AS "employeeImageUrl"
     FROM employee_profiles WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function saveFaceTemplate(
  userId: string,
  descriptor: number[],
  source: FaceTemplateSource,
  image: StoredImage | null,
  expectedEmployeeImageUrl?: string,
): Promise<{ previousImagePublicId: string | null } | null> {
  if (descriptor.length !== 128 || !Array.from(descriptor).every((value) => Number.isFinite(value))) {
    throw new Error("Face descriptor must contain 128 finite numbers");
  }
  // Lock before obtaining the previous image so concurrent enrollments cannot
  // delete the newly selected image or leave replaced images orphaned.
  const result = await pool.query<{ previousImagePublicId: string | null }>(
    `WITH previous AS MATERIALIZED (
       SELECT user_id, face_image_public_id FROM employee_profiles
       WHERE user_id = $1
         AND ($3::text <> 'hr_photo' OR (face_descriptor IS NULL AND employee_image_url = $6))
       FOR UPDATE
     )
     UPDATE employee_profiles p
     SET face_descriptor = $2::real[], face_source = $3,
         face_image_url = $4, face_image_public_id = $5,
         face_enrolled_at = NOW(), updated_at = NOW()
     FROM previous WHERE p.user_id = previous.user_id
     RETURNING previous.face_image_public_id AS "previousImagePublicId"`,
    [userId, descriptor, source, image?.url ?? null, image?.publicId ?? null, expectedEmployeeImageUrl ?? null],
  );
  return result.rows[0] ?? null;
}

export async function clearFaceTemplate(userId: string, onlySource?: FaceTemplateSource): Promise<string | null> {
  const result = await pool.query<{ previousImagePublicId: string | null }>(
    `WITH previous AS MATERIALIZED (
       SELECT user_id, face_image_public_id FROM employee_profiles
       WHERE user_id = $1 AND ($2::text IS NULL OR face_source = $2)
       FOR UPDATE
     )
     UPDATE employee_profiles p
     SET face_descriptor = NULL, face_source = NULL, face_image_url = NULL,
         face_image_public_id = NULL, face_enrolled_at = NULL, updated_at = NOW()
     FROM previous WHERE p.user_id = previous.user_id
     RETURNING previous.face_image_public_id AS "previousImagePublicId"`,
    [userId, onlySource ?? null],
  );
  return result.rows[0]?.previousImagePublicId ?? null;
}

export async function clearProfileImage(
  userId: string,
  imageType: "employee" | "company",
): Promise<{
  removedPublicId: string | null;
  profile: EmployeeProfileRecord;
} | null> {
  const columns = IMAGE_COLUMNS[imageType];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await lockProfileImages(client, userId);

    if (!current) {
      await client.query("ROLLBACK");

      return null;
    }

    const removedPublicId =
      imageType === "employee"
        ? current.employeeImagePublicId
        : current.companyImagePublicId;

    if (removedPublicId) {
      await client.query(
        `UPDATE employee_profiles
         SET ${columns.url} = NULL, ${columns.publicId} = NULL, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      if (imageType === "employee") {
        await client.query(
          `UPDATE employee_profiles SET face_descriptor = NULL, face_source = NULL,
             face_image_url = NULL, face_image_public_id = NULL, face_enrolled_at = NULL
           WHERE user_id = $1 AND face_source = 'hr_photo'`,
          [userId],
        );
      }
    }

    const result = await client.query<ProfileRow>(
      `${PROFILE_SELECT} WHERE p.user_id = $1`,
      [userId],
    );

    await client.query("COMMIT");

    return {
      removedPublicId,
      profile: toProfileRecord(result.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
