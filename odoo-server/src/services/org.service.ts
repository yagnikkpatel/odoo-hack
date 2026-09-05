import { z } from "zod";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import * as orgRepository from "../repositories/org.repository";
import { DepartmentRow, EmploymentTypeRow, JobPositionRow } from "../types/org";

const departmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parent_id: z.uuid().nullable().optional(),
  manager_id: z.uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const jobPositionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  department_id: z.uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const employmentTypeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "must be uppercase letters, digits and underscores"),
  active: z.boolean().optional(),
});

/** `?active=` is tri-state: absent means "all", not "active only". */
function activeFilter(query: Record<string, unknown>): boolean | undefined {
  if (query.active === undefined || query.active === "") {
    return undefined;
  }

  return query.active === "true" || query.active === true;
}

// ── departments ────────────────────────────────────────────────────────────

export async function listDepartments(query: Record<string, unknown>) {
  const rows = await orgRepository.listDepartments({
    q: typeof query.q === "string" && query.q.trim() ? query.q.trim() : undefined,
    active: activeFilter(query),
  });

  return rows.map(presentDepartment);
}

export async function createDepartment(input: unknown) {
  const data = parseOrThrow(departmentSchema, input);

  await assertDepartmentExists(data.parent_id);

  return presentDepartment(
    await orgRepository.insertDepartment({
      name: data.name,
      parentId: data.parent_id,
      managerId: data.manager_id,
      active: data.active,
    }),
  );
}

export async function updateDepartment(id: string, input: unknown) {
  const data = parseOrThrow(departmentSchema.partial(), input);
  const existing = await orgRepository.findDepartment(id);

  if (!existing) {
    throw new AppError(404, "Department not found.", "not_found");
  }

  if (data.parent_id === id) {
    throw new AppError(400, "A department cannot be its own parent.", "validation_error", [
      { field: "parent_id", message: "cannot reference itself" },
    ]);
  }

  await assertDepartmentExists(data.parent_id);

  return presentDepartment(
    (await orgRepository.updateDepartment(id, {
      name: data.name,
      parentId: data.parent_id,
      managerId: data.manager_id,
      active: data.active,
    })) as DepartmentRow,
  );
}

/** BR-EMP-7: archive, never delete, and refuse while staff are still assigned. */
export async function archiveDepartment(id: string): Promise<void> {
  const existing = await orgRepository.findDepartment(id);

  if (!existing) {
    throw new AppError(404, "Department not found.", "not_found");
  }

  const assigned = await orgRepository.countActiveEmployeesInDepartment(id);

  if (assigned > 0) {
    throw new AppError(
      409,
      `${assigned} employee(s) are still assigned to this department — reassign them first.`,
      "in_use",
    );
  }

  await orgRepository.updateDepartment(id, { active: false });
}

// ── job positions ──────────────────────────────────────────────────────────

export async function listJobPositions(query: Record<string, unknown>) {
  const rows = await orgRepository.listJobPositions({
    departmentId: typeof query.department_id === "string" ? query.department_id : undefined,
    active: activeFilter(query),
  });

  return rows.map(presentJobPosition);
}

export async function createJobPosition(input: unknown) {
  const data = parseOrThrow(jobPositionSchema, input);

  await assertDepartmentExists(data.department_id);

  return presentJobPosition(
    await orgRepository.insertJobPosition({
      name: data.name,
      departmentId: data.department_id,
      active: data.active,
    }),
  );
}

export async function updateJobPosition(id: string, input: unknown) {
  const data = parseOrThrow(jobPositionSchema.partial(), input);

  if (!(await orgRepository.findJobPosition(id))) {
    throw new AppError(404, "Job position not found.", "not_found");
  }

  await assertDepartmentExists(data.department_id);

  return presentJobPosition(
    (await orgRepository.updateJobPosition(id, {
      name: data.name,
      departmentId: data.department_id,
      active: data.active,
    })) as JobPositionRow,
  );
}

export async function archiveJobPosition(id: string): Promise<void> {
  if (!(await orgRepository.findJobPosition(id))) {
    throw new AppError(404, "Job position not found.", "not_found");
  }

  const assigned = await orgRepository.countActiveEmployeesInJobPosition(id);

  if (assigned > 0) {
    throw new AppError(
      409,
      `${assigned} employee(s) still hold this job position — reassign them first.`,
      "in_use",
    );
  }

  await orgRepository.updateJobPosition(id, { active: false });
}

// ── employment types ───────────────────────────────────────────────────────

export async function listEmploymentTypes(query: Record<string, unknown>) {
  return orgRepository.listEmploymentTypes({ active: activeFilter(query) });
}

export async function createEmploymentType(input: unknown): Promise<EmploymentTypeRow> {
  const data = parseOrThrow(employmentTypeSchema, input);

  return orgRepository.insertEmploymentType(data);
}

// ── presentation ───────────────────────────────────────────────────────────

async function assertDepartmentExists(id: string | null | undefined): Promise<void> {
  if (id && !(await orgRepository.findDepartment(id))) {
    throw new AppError(400, "Unknown department.", "validation_error", [
      { field: "department_id", message: "no such department" },
    ]);
  }
}

function presentDepartment(row: DepartmentRow) {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    manager: row.manager_id
      ? {
          id: row.manager_id,
          employee_number: row.manager_employee_number,
          full_name: row.manager_full_name,
          photo_url: row.manager_photo_url,
        }
      : null,
    employee_count: Number(row.employee_count),
    active: row.active,
  };
}

function presentJobPosition(row: JobPositionRow) {
  return {
    id: row.id,
    name: row.name,
    department_id: row.department_id,
    department_name: row.department_name,
    employee_count: Number(row.employee_count),
    active: row.active,
  };
}
