import { PoolClient } from "pg";
import { pool } from "../lib/db";
import {
  EmployeeProfileImageIds,
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
};

export type ProfileFields = {
  jobPosition?: string;
  department?: string;
  contact?: string;
  managerId?: string;
  workingSchedule?: string;
  companyName?: string;
  workLocation?: string;
  location?: string;
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

export async function findManagerRole(
  managerId: string,
): Promise<string | null> {
  const result = await pool.query<{ role: string }>(
    `SELECT r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
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
}): Promise<{ rows: EmployeeProfileRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.department) {
    values.push(query.department);
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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<ProfileRow & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${PROFILE_COLUMNS}
     ${PROFILE_FROM}
     ${where}
     ORDER BY u.name
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(toProfileRecord),
    total: result.rows[0]?.total ?? 0,
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
    Pick<ProfileFields, "managerId" | "location">;
}): Promise<EmployeeProfileRecord> {
  await pool.query(
    `INSERT INTO employee_profiles (
       user_id, job_position, department, contact, manager_id,
       working_schedule, company_name, work_location, location
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
