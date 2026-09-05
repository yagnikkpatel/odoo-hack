import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const SALT_ROUNDS = 12;
const DUMMY_PASSWORD = "Password123!";

const FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "Lucas", "Mia", "Elijah", "Amelia", "James", "Charlotte",
  "Benjamin", "Harper", "Henry", "Evelyn", "Alexander", "Abigail",
  "Sebastian", "Emily", "Jack", "Ella", "Owen", "Scarlett", "Daniel",
  "Grace", "Matthew", "Chloe", "Samuel", "Victoria", "David", "Zoey",
  "Joseph", "Riley", "Carter", "Nora", "Wyatt",
];

const LAST_NAMES = [
  "Bennett", "Carter", "Simmons", "Foster", "Hughes", "Brooks", "Reid",
  "Coleman", "Barnes", "Fisher", "Powell", "Long", "Patterson", "Flores",
  "Washington", "Butler", "Griffin", "Diaz", "Hayes", "Myers", "Ford",
  "Hamilton", "Graham", "Sullivan", "Wallace", "Woods", "Cole", "Dawson",
  "Larsen", "Nolan",
];

const WORK_LOCATIONS = [
  "New York, NY", "San Francisco, CA", "Austin, TX", "Chicago, IL", "Remote",
];

const WORKING_SCHEDULES = [
  "Monday - Friday, 9:00 AM - 5:00 PM",
  "Monday - Friday, 8:00 AM - 4:00 PM",
  "Flexible / Remote",
];

const COMPANY_NAME = "NexaCorp Inc.";

const EMPLOYEE_DEPARTMENTS: { department: string; titles: string[] }[] = [
  { department: "Engineering", titles: ["Software Engineer", "Senior Software Engineer", "QA Engineer", "DevOps Engineer"] },
  { department: "Sales", titles: ["Sales Executive", "Account Manager", "Sales Development Rep"] },
  { department: "Marketing", titles: ["Marketing Specialist", "Content Strategist", "SEO Analyst"] },
  { department: "Customer Support", titles: ["Support Associate", "Support Team Lead"] },
  { department: "Finance", titles: ["Financial Analyst", "Accountant"] },
  { department: "Operations", titles: ["Operations Coordinator", "Operations Manager"] },
  { department: "Product", titles: ["Product Manager", "Product Analyst"] },
  { department: "Design", titles: ["UI/UX Designer", "Graphic Designer"] },
];

const PAYROLL_USER_TITLES = ["Payroll Specialist", "Payroll Associate", "Payroll Coordinator", "Payroll Analyst"];
const PAYROLL_MANAGER_TITLES = ["Payroll Manager", "Senior Payroll Manager", "Payroll Operations Manager"];
const HR_MANAGER_TITLES = ["HR Manager", "Senior HR Manager", "HR Business Partner", "People Operations Manager"];

function fullName(i: number): string {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function contactFor(i: number): string {
  return `+1-202-555-${String(1000 + i).slice(-4)}`;
}

function pick<T>(items: T[], i: number): T {
  return items[i % items.length];
}

type RoleRow = { id: string; name: string };
type UserRow = { id: string };

async function resolveRoleIds(
  client: PoolClient,
  roleNames: string[],
): Promise<Map<string, string>> {
  const result = await client.query<RoleRow>(
    "SELECT id, name FROM roles WHERE name = ANY($1)",
    [roleNames],
  );

  const roleIdByName = new Map(result.rows.map((row) => [row.name, row.id]));

  for (const roleName of roleNames) {
    if (!roleIdByName.has(roleName)) {
      throw new Error(`role not found: ${roleName}`);
    }
  }

  return roleIdByName;
}

async function upsertUser(
  client: PoolClient,
  params: { name: string; email: string; passwordHash: string; roleId: string },
): Promise<string> {
  const inserted = await client.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [params.name, params.email, params.passwordHash, params.roleId],
  );

  if (inserted.rows[0]) return inserted.rows[0].id;

  const existing = await client.query<UserRow>(
    "SELECT id FROM users WHERE email = $1",
    [params.email],
  );

  return existing.rows[0].id;
}

async function upsertProfile(
  client: PoolClient,
  params: {
    userId: string;
    jobPosition: string;
    department: string;
    contact: string;
    managerId: string | null;
    workingSchedule: string;
    companyName: string;
    workLocation: string;
    location: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO employee_profiles
       (user_id, job_position, department, contact, manager_id, working_schedule, company_name, work_location, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id) DO NOTHING`,
    [
      params.userId,
      params.jobPosition,
      params.department,
      params.contact,
      params.managerId,
      params.workingSchedule,
      params.companyName,
      params.workLocation,
      params.location,
    ],
  );
}

async function seedDummyData(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleIdByName = await resolveRoleIds(client, [
      "hr_manager",
      "hr_payroll_user",
      "hr_payroll_manager",
      "employee",
    ]);
    const passwordHash = await bcrypt.hash(DUMMY_PASSWORD, SALT_ROUNDS);

    // 50 HR managers: manager2@gmail.com .. manager51@gmail.com
    const hrManagerIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const emailNumber = i + 2;
      const userId = await upsertUser(client, {
        name: fullName(i),
        email: `manager${emailNumber}@gmail.com`,
        passwordHash,
        roleId: roleIdByName.get("hr_manager")!,
      });
      await upsertProfile(client, {
        userId,
        jobPosition: pick(HR_MANAGER_TITLES, i),
        department: "Human Resources",
        contact: contactFor(i),
        managerId: null,
        workingSchedule: pick(WORKING_SCHEDULES, i),
        companyName: COMPANY_NAME,
        workLocation: pick(WORK_LOCATIONS, i),
        location: pick(WORK_LOCATIONS, i),
      });
      hrManagerIds.push(userId);
    }
    logger.info(`seeded ${hrManagerIds.length} hr_manager users with profiles`);

    // 50 HR payroll managers: payrollmanager1@gmail.com .. payrollmanager50@gmail.com
    const hrPayrollManagerIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const userId = await upsertUser(client, {
        name: fullName(i + 50),
        email: `payrollmanager${i + 1}@gmail.com`,
        passwordHash,
        roleId: roleIdByName.get("hr_payroll_manager")!,
      });
      await upsertProfile(client, {
        userId,
        jobPosition: pick(PAYROLL_MANAGER_TITLES, i),
        department: "Payroll",
        contact: contactFor(i + 50),
        managerId: hrManagerIds[i % hrManagerIds.length],
        workingSchedule: pick(WORKING_SCHEDULES, i),
        companyName: COMPANY_NAME,
        workLocation: pick(WORK_LOCATIONS, i),
        location: pick(WORK_LOCATIONS, i),
      });
      hrPayrollManagerIds.push(userId);
    }
    logger.info(`seeded ${hrPayrollManagerIds.length} hr_payroll_manager users with profiles`);

    const managerPool = [...hrManagerIds, ...hrPayrollManagerIds];

    // 50 HR payroll users: payrolluser1@gmail.com .. payrolluser50@gmail.com
    let payrollUserCount = 0;
    for (let i = 0; i < 50; i++) {
      const userId = await upsertUser(client, {
        name: fullName(i + 100),
        email: `payrolluser${i + 1}@gmail.com`,
        passwordHash,
        roleId: roleIdByName.get("hr_payroll_user")!,
      });
      await upsertProfile(client, {
        userId,
        jobPosition: pick(PAYROLL_USER_TITLES, i),
        department: "Payroll",
        contact: contactFor(i + 100),
        managerId: managerPool[i % managerPool.length],
        workingSchedule: pick(WORKING_SCHEDULES, i),
        companyName: COMPANY_NAME,
        workLocation: pick(WORK_LOCATIONS, i),
        location: pick(WORK_LOCATIONS, i),
      });
      payrollUserCount++;
    }
    logger.info(`seeded ${payrollUserCount} hr_payroll_user users with profiles`);

    // 150 employees: employee2@gmail.com .. employee151@gmail.com (employee1@gmail.com is a real, pre-existing account)
    let employeeCount = 0;
    for (let i = 0; i < 150; i++) {
      const { department, titles } = pick(EMPLOYEE_DEPARTMENTS, i);
      const userId = await upsertUser(client, {
        name: fullName(i + 150),
        email: `employee${i + 2}@gmail.com`,
        passwordHash,
        roleId: roleIdByName.get("employee")!,
      });
      await upsertProfile(client, {
        userId,
        jobPosition: pick(titles, i),
        department,
        contact: contactFor(i + 150),
        managerId: managerPool[i % managerPool.length],
        workingSchedule: pick(WORKING_SCHEDULES, i),
        companyName: COMPANY_NAME,
        workLocation: pick(WORK_LOCATIONS, i),
        location: pick(WORK_LOCATIONS, i),
      });
      employeeCount++;
    }
    logger.info(`seeded ${employeeCount} employee users with profiles`);

    await client.query("COMMIT");
    logger.info("dummy data seed complete");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedDummyData()
  .catch((error) => {
    logger.error({ err: error }, "seed-dummy failed");
    process.exit(1);
  })
  .finally(() => pool.end());
