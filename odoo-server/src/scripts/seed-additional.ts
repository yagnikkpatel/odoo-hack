import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { seedContract } from "./lib/seed-contract";
import { pool } from "../lib/db";
import { redis } from "../lib/redis";
import { findPayrollComputeInputs } from "../repositories/payrun.repository";
import { logger } from "../lib/logger";
import {
  computePayrun,
  createPayrun,
  listEligibleEmployees,
  markPayrunPaid,
  validatePayrun,
} from "../services/payroll.service";

/**
 * Adds another batch of employees on top of whatever `npm run seed` already
 * put in the database -- it never truncates. Run `npm run seed` first; this
 * script only reads the roles, salary structures and time-off types it
 * creates and fails fast if they are missing.
 */
const NEW_EMPLOYEE_COUNT = 300;

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "00000000";
const SALT_ROUNDS = 10;
const ATTENDANCE_DAYS = 365;
const PAYROLL_MONTHS = 9;
const COMPANY = "NexaCorp Technologies Pvt. Ltd.";

// ---------------------------------------------------------------------------
// Deterministic randomness -- seeded differently from seed.ts so the two runs
// don't draw the same "random" name/wage sequence.
// ---------------------------------------------------------------------------

let randomState = 0x1234abcd;

function random(): number {
  randomState |= 0;
  randomState = (randomState + 0x6d2b79f5) | 0;
  let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function atTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function monthRange(monthsAgo: number): { start: string; end: string; label: string } {
  const anchor = addMonths(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), -monthsAgo);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { start: isoDate(start), end: isoDate(end), label };
}

// ---------------------------------------------------------------------------
// Reference data -- same shape as seed.ts, so the new intake reads as more of
// the same company rather than a visibly different generator.
// ---------------------------------------------------------------------------

type OfficeSite = {
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusM: number;
};

const SITES: OfficeSite[] = [
  { name: "Ahmedabad HQ", location: "Ahmedabad, Gujarat", latitude: 23.022505, longitude: 72.5713621, radiusM: 200 },
  { name: "Bengaluru Campus", location: "Bengaluru, Karnataka", latitude: 12.9715987, longitude: 77.5945627, radiusM: 300 },
  { name: "Mumbai Office", location: "Mumbai, Maharashtra", latitude: 19.0759837, longitude: 72.8776559, radiusM: 250 },
  { name: "Pune Tech Park", location: "Pune, Maharashtra", latitude: 18.5204303, longitude: 73.8567437, radiusM: 220 },
  { name: "Hyderabad Hub", location: "Hyderabad, Telangana", latitude: 17.385044, longitude: 78.486671, radiusM: 260 },
  { name: "Gurugram Office", location: "Gurugram, Haryana", latitude: 28.4594965, longitude: 77.0266383, radiusM: 180 },
  { name: "Chennai Delivery Centre", location: "Chennai, Tamil Nadu", latitude: 13.0826802, longitude: 80.2707184, radiusM: 240 },
  { name: "Noida Annexe", location: "Noida, Uttar Pradesh", latitude: 28.5355161, longitude: 77.3910265, radiusM: 160 },
  { name: "Kolkata Office", location: "Kolkata, West Bengal", latitude: 22.572646, longitude: 88.363895, radiusM: 200 },
  { name: "Remote - India", location: "Remote", latitude: 20.593684, longitude: 78.96288, radiusM: 5000 },
];

const SCHEDULES = [
  "Standard 40 hours/week (Mon-Fri, 09:00-18:00)",
  "Standard 40 hours/week (Mon-Fri, 10:00-19:00)",
  "Early shift (Mon-Fri, 07:00-16:00)",
  "Late shift (Mon-Fri, 13:00-22:00)",
  "Night shift (Mon-Fri, 22:00-06:00)",
  "Compressed week (Mon-Thu, 08:00-18:30)",
  "Part-time 20 hours/week (Mon-Fri, 09:00-13:00)",
  "Flexible / Remote (core hours 11:00-16:00)",
  "Weekend support (Wed-Sun, 10:00-19:00)",
  "Intern schedule (Mon-Fri, 10:00-16:00)",
];

type DepartmentSpec = {
  name: string;
  /** Share of the new intake this department gets, out of NEW_EMPLOYEE_COUNT. */
  weight: number;
  wage: [number, number];
  positions: string[];
};

/** Same twelve departments as seed.ts, weighted the same way its headcounts were. */
const DEPARTMENTS: DepartmentSpec[] = [
  {
    name: "Engineering",
    weight: 48,
    wage: [55000, 190000],
    positions: [
      "Software Engineer I", "Software Engineer II", "Senior Software Engineer",
      "Staff Engineer", "Principal Engineer", "Frontend Engineer",
      "Backend Engineer", "Mobile Engineer", "Platform Engineer",
      "Site Reliability Engineer", "Engineering Manager", "Database Administrator",
    ],
  },
  {
    name: "Quality Assurance",
    weight: 16,
    wage: [42000, 110000],
    positions: ["QA Engineer", "Senior QA Engineer", "Automation Test Engineer", "QA Lead", "Performance Test Engineer"],
  },
  {
    name: "Product",
    weight: 14,
    wage: [70000, 210000],
    positions: ["Associate Product Manager", "Product Manager", "Senior Product Manager", "Group Product Manager", "Product Analyst", "Technical Program Manager"],
  },
  {
    name: "Design",
    weight: 13,
    wage: [45000, 150000],
    positions: ["UI Designer", "UX Designer", "Product Designer", "Senior Product Designer", "Design Lead", "UX Researcher", "Motion Designer"],
  },
  {
    name: "Sales",
    weight: 28,
    wage: [40000, 175000],
    positions: ["Sales Development Representative", "Account Executive", "Senior Account Executive", "Enterprise Account Executive", "Regional Sales Manager", "Sales Operations Analyst", "Solutions Consultant"],
  },
  {
    name: "Marketing",
    weight: 17,
    wage: [38000, 145000],
    positions: ["Marketing Associate", "Content Strategist", "SEO Analyst", "Performance Marketing Manager", "Brand Manager", "Product Marketing Manager", "Events Coordinator"],
  },
  {
    name: "Customer Success",
    weight: 22,
    wage: [32000, 120000],
    positions: ["Support Associate", "Senior Support Associate", "Support Team Lead", "Customer Success Manager", "Technical Account Manager", "Implementation Specialist"],
  },
  {
    name: "Finance",
    weight: 15,
    wage: [45000, 185000],
    positions: ["Accounts Assistant", "Accountant", "Senior Accountant", "Financial Analyst", "FP&A Manager", "Treasury Analyst", "Finance Controller"],
  },
  {
    name: "Human Resources",
    weight: 13,
    wage: [38000, 165000],
    positions: ["HR Associate", "HR Generalist", "Talent Acquisition Specialist", "Learning & Development Lead", "HR Business Partner", "People Operations Manager"],
  },
  {
    name: "Operations",
    weight: 15,
    wage: [35000, 140000],
    positions: ["Operations Associate", "Operations Coordinator", "Operations Manager", "Facilities Manager", "Vendor Manager", "Procurement Specialist"],
  },
  {
    name: "Legal & Compliance",
    weight: 8,
    wage: [60000, 200000],
    positions: ["Legal Associate", "Corporate Counsel", "Compliance Analyst", "Contracts Manager", "Data Protection Officer"],
  },
  {
    name: "Data & Analytics",
    weight: 18,
    wage: [55000, 195000],
    positions: ["Data Analyst", "Senior Data Analyst", "Data Engineer", "Analytics Engineer", "Data Scientist", "Machine Learning Engineer", "BI Developer"],
  },
];

const FIRST_NAMES = [
  "Aarav", "Aditi", "Advait", "Ananya", "Arjun", "Bhavya", "Chirag", "Darshan",
  "Devika", "Dhruv", "Esha", "Farhan", "Gaurav", "Harshita", "Ishaan", "Ishita",
  "Jatin", "Kabir", "Kavya", "Kiran", "Lakshmi", "Manav", "Meera", "Naina",
  "Neel", "Nikhil", "Ojas", "Pallavi", "Parth", "Priya", "Rahul", "Raghav",
  "Riya", "Rohan", "Sanya", "Sarthak", "Shreya", "Siddharth", "Simran", "Tanvi",
  "Tarun", "Uday", "Vaishnavi", "Varun", "Vihaan", "Yash", "Zara", "Anjali",
  "Karthik", "Nandini", "Aryan", "Diya", "Krish", "Mira", "Om", "Pooja",
  "Rhea", "Sameer", "Tanya", "Vikram",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Iyer", "Nair", "Reddy", "Menon", "Kulkarni",
  "Chatterjee", "Bose", "Desai", "Joshi", "Mehta", "Kapoor", "Malhotra",
  "Chauhan", "Sinha", "Bhatt", "Rao", "Pillai", "Gupta", "Agarwal", "Banerjee",
  "Deshpande", "Trivedi", "Shetty", "Ghosh", "Saxena", "Chopra", "Mukherjee",
  "Bhatia", "Rastogi", "Khanna", "Suri",
];

// ---------------------------------------------------------------------------
// Leave configuration -- must match the codes seed.ts already created.
// ---------------------------------------------------------------------------

type TimeOffTypeSpec = {
  code: string;
  unit: "days" | "hours";
  requiresAllocation: boolean;
  allocation?: number;
};

const TIME_OFF_TYPES: TimeOffTypeSpec[] = [
  { code: "PTO", unit: "days", requiresAllocation: true, allocation: 24 },
  { code: "SICK", unit: "days", requiresAllocation: false },
  { code: "CASUAL", unit: "days", requiresAllocation: true, allocation: 12 },
  { code: "COMPOFF", unit: "hours", requiresAllocation: true, allocation: 40 },
  { code: "WFH", unit: "days", requiresAllocation: false },
  { code: "MATERNITY", unit: "days", requiresAllocation: true, allocation: 182 },
  { code: "PATERNITY", unit: "days", requiresAllocation: true, allocation: 15 },
  { code: "BEREAVE", unit: "days", requiresAllocation: false },
  { code: "UNPAID", unit: "days", requiresAllocation: false },
  { code: "SABBATICAL", unit: "days", requiresAllocation: true, allocation: 60 },
];

const LEAVE_REASONS: Record<string, string[]> = {
  PTO: ["Family vacation in Goa", "Annual trip home", "Extended weekend break", "Wedding in the family", "Travelling abroad", "Festival holidays with family"],
  SICK: ["Down with viral fever", "Food poisoning", "Migraine, unable to work", "Recovering from dengue", "Post-surgery recovery", "Seasonal flu"],
  CASUAL: ["Personal errand", "House shifting", "Bank and paperwork", "Parent-teacher meeting", "Vehicle registration"],
  COMPOFF: ["Weekend release support", "On-call rotation over the weekend", "Production incident on Saturday", "Client go-live over the weekend"],
  WFH: ["Plumber visiting at home", "Society maintenance work", "Working from hometown", "Recovering, able to work remotely"],
  MATERNITY: ["Maternity leave"],
  PATERNITY: ["Paternity leave"],
  BEREAVE: ["Bereavement in the family"],
  UNPAID: ["Personal sabbatical, unpaid", "Extended travel, leave balance exhausted", "Family emergency beyond balance"],
  SABBATICAL: ["Study break", "Extended career break"],
};

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

type SeedUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  jobPosition: string;
  site: OfficeSite;
  schedule: string;
  wage: number;
  structure: string;
  managerId: string | null;
  joinedDaysAgo: number;
  status: "active" | "inactive";
};

function slugEmail(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z]+/g, ".");
  let email = `${base}@peoplepay360.com`;
  let suffix = 2;

  while (taken.has(email)) {
    email = `${base}${suffix}@peoplepay360.com`;
    suffix++;
  }

  taken.add(email);
  return email;
}

function uniqueName(taken: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }

  const fallback = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${taken.size}`;
  taken.add(fallback);
  return fallback;
}

function contactNumber(seed: number): string {
  return `+91 ${String(90000 + (seed * 137) % 9999).slice(0, 5)} ${String(10000 + (seed * 911) % 89999).slice(0, 5)}`;
}

function faceDescriptor(): number[] {
  return Array.from({ length: 128 }, () => Math.round((random() * 2 - 1) * 1e6) / 1e6);
}

function scheduleFor(department: string, jobPosition: string): string {
  if (department === "Customer Success") {
    return pick([SCHEDULES[2], SCHEDULES[3], SCHEDULES[4], SCHEDULES[8]]);
  }

  if (department === "Operations") {
    return pick([SCHEDULES[2], SCHEDULES[3], SCHEDULES[5], SCHEDULES[0]]);
  }

  if (department === "Engineering" || department === "Data & Analytics") {
    return pick([SCHEDULES[0], SCHEDULES[1], SCHEDULES[1], SCHEDULES[7], SCHEDULES[5]]);
  }

  if (department === "Sales" || department === "Marketing") {
    return pick([SCHEDULES[0], SCHEDULES[1], SCHEDULES[7]]);
  }

  return chance(0.05) ? SCHEDULES[6] : pick([SCHEDULES[0], SCHEDULES[0], SCHEDULES[1]]);
}

function structureFor(department: string, wage: number): string {
  if (wage >= 165000) return "Executive Salary";
  if (department === "Customer Success" || department === "Operations") return "Shift Operations Salary";
  return "Regular Salary";
}

/** Spreads NEW_EMPLOYEE_COUNT across departments in proportion to `weight`. */
function departmentIntake(count: number): { department: DepartmentSpec; headcount: number }[] {
  const totalWeight = DEPARTMENTS.reduce((sum, department) => sum + department.weight, 0);
  const raw = DEPARTMENTS.map((department) => (count * department.weight) / totalWeight);
  const base = raw.map((value) => Math.floor(value));
  const remainder = count - base.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - base[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remainder; i++) {
    base[order[i].index]++;
  }

  return DEPARTMENTS.map((department, index) => ({ department, headcount: base[index] }));
}

// ---------------------------------------------------------------------------
// Existing state -- everything this script reuses instead of recreating.
// ---------------------------------------------------------------------------

type ExistingState = {
  roleId: string;
  approverIds: string[];
  payrollOwnerId: string;
  departmentHeads: Map<string, string>;
  timeOffTypes: Map<string, { id: string; spec: TimeOffTypeSpec }>;
  structures: Map<string, string>;
  names: Set<string>;
  emails: Set<string>;
};

async function loadExistingState(client: PoolClient): Promise<ExistingState> {
  const role = await client.query<{ id: string }>(
    "SELECT id FROM roles WHERE name = 'employee'",
  );
  if (role.rows.length === 0) {
    throw new Error('role not found: employee -- run "npm run seed" first');
  }

  const approvers = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name IN ('hr_manager', 'admin')) AND status = 'active'",
  );
  if (approvers.rows.length === 0) {
    throw new Error('no HR managers found -- run "npm run seed" first');
  }

  const payrollOwner = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'hr_payroll_manager') AND status = 'active' LIMIT 1",
  );
  if (payrollOwner.rows.length === 0) {
    throw new Error('no payroll manager found -- run "npm run seed" first');
  }

  // One existing active employee per department, to manage the new intake --
  // the same role seed.ts's own department heads play for everyone else.
  const heads = await client.query<{ department: string; user_id: string }>(
    `SELECT DISTINCT ON (p.department) p.department, p.user_id
     FROM employee_profiles p
     JOIN users u ON u.id = p.user_id
     WHERE u.status = 'active' AND u.role_id = $1
     ORDER BY p.department, u.created_at ASC`,
    [role.rows[0].id],
  );
  const departmentHeads = new Map(heads.rows.map((row) => [row.department, row.user_id]));

  const typeRows = await client.query<{ id: string; code: string }>(
    "SELECT id, code FROM time_off_types",
  );
  const typeByCode = new Map(typeRows.rows.map((row) => [row.code, row.id]));
  const timeOffTypes = new Map<string, { id: string; spec: TimeOffTypeSpec }>();
  for (const spec of TIME_OFF_TYPES) {
    const id = typeByCode.get(spec.code);
    if (!id) throw new Error(`time off type not found: ${spec.code} -- run "npm run seed" first`);
    timeOffTypes.set(spec.code, { id, spec });
  }

  const structureRows = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM salary_structures",
  );
  if (structureRows.rows.length === 0) {
    throw new Error('no salary structures found -- run "npm run seed" first');
  }
  const structures = new Map(structureRows.rows.map((row) => [row.name, row.id]));

  const existingPeople = await client.query<{ name: string; email: string }>(
    "SELECT name, email FROM users",
  );

  return {
    roleId: role.rows[0].id,
    approverIds: approvers.rows.map((row) => row.id),
    payrollOwnerId: payrollOwner.rows[0].id,
    departmentHeads,
    timeOffTypes,
    structures,
    names: new Set(existingPeople.rows.map((row) => row.name)),
    emails: new Set(existingPeople.rows.map((row) => row.email)),
  };
}

function buildIntake(state: ExistingState): SeedUser[] {
  const people: SeedUser[] = [];

  for (const { department, headcount } of departmentIntake(NEW_EMPLOYEE_COUNT)) {
    for (let i = 0; i < headcount; i++) {
      const jobPosition = pick(department.positions);
      const seniority = department.positions.indexOf(jobPosition) / department.positions.length;
      const [minWage, maxWage] = department.wage;
      const wage = Math.round(
        (minWage + (maxWage - minWage) * (0.25 + seniority * 0.75) * (0.85 + random() * 0.3)) / 500,
      ) * 500;
      const name = uniqueName(state.names);
      const email = slugEmail(name, state.emails);

      people.push({
        id: "",
        name,
        email,
        department: department.name,
        jobPosition,
        site: pick(SITES),
        schedule: scheduleFor(department.name, jobPosition),
        wage: Math.max(minWage, Math.min(maxWage, wage)),
        structure: structureFor(department.name, wage),
        managerId: state.departmentHeads.get(department.name) ?? state.approverIds[0],
        joinedDaysAgo: randomInt(3, 400),
        // A fresh intake skews far more active than the settled directory.
        status: chance(0.02) ? "inactive" : "active",
      });
    }
  }

  return people;
}

async function insertPeople(
  client: PoolClient,
  people: SeedUser[],
  roleId: string,
  passwordHash: string,
): Promise<void> {
  for (const person of people) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, role_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id`,
      [
        person.name,
        person.email,
        passwordHash,
        roleId,
        person.status,
        addDays(TODAY, -person.joinedDaysAgo),
      ],
    );

    person.id = result.rows[0].id;
  }
}

async function insertProfiles(client: PoolClient, people: SeedUser[], startIndex: number): Promise<void> {
  for (const [offset, person] of people.entries()) {
    const enrolled = chance(0.72);
    const avatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(person.name)}`;

    await client.query(
      `INSERT INTO employee_profiles (
         user_id, job_position, department, contact, manager_id, working_schedule,
         company_name, work_location, location, employee_image_url, company_image_url,
         work_latitude, work_longitude, work_radius_m,
         face_descriptor, face_source, face_image_url, face_enrolled_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        person.id,
        person.jobPosition,
        person.department,
        contactNumber(startIndex + offset),
        person.managerId,
        person.schedule,
        COMPANY,
        person.site.name,
        person.site.location,
        avatar,
        "https://api.dicebear.com/9.x/initials/svg?seed=NexaCorp",
        person.site.latitude,
        person.site.longitude,
        person.site.radiusM,
        enrolled ? faceDescriptor() : null,
        enrolled ? (chance(0.7) ? "self" : "hr_photo") : null,
        enrolled ? avatar : null,
        enrolled ? addDays(TODAY, -randomInt(2, Math.min(300, person.joinedDaysAgo + 1))) : null,
      ],
    );
  }
}

/** One running contract per new hire; a departed hire's contract has already expired. */
async function insertContracts(client: PoolClient, people: SeedUser[]): Promise<number> {
  let count = 0;

  for (const person of people) {
    const joined = addDays(TODAY, -person.joinedDaysAgo);

    if (person.status === "inactive") {
      const leftOn = addDays(TODAY, -randomInt(1, Math.max(1, person.joinedDaysAgo - 1)));

      await seedContract(client, {
        employeeId: person.id,
        startDate: isoDate(joined),
        endDate: isoDate(leftOn),
        wage: person.wage,
        status: "expired",
        createdAt: joined,
        updatedAt: leftOn,
      });
      count++;
      continue;
    }

    await seedContract(client, {
      employeeId: person.id,
      startDate: isoDate(joined),
      endDate: isoDate(addDays(TODAY, randomInt(200, 900))),
      wage: person.wage,
      status: "running",
      createdAt: joined,
    });
    count++;
  }

  return count;
}

function verificationPayload(person: SeedUser, at: Date, enrolled: boolean): string | null {
  if (!enrolled) return null;

  const jitter = () => (random() - 0.5) * 0.0008;

  return JSON.stringify({
    verifiedAt: at.toISOString(),
    selfieUrl: `https://res.cloudinary.com/demo/image/upload/attendance/${person.id}-${at.getTime()}.jpg`,
    selfiePublicId: `attendance/${person.id}-${at.getTime()}`,
    face: {
      status: "matched",
      distance: Math.round(random() * 0.28 * 1000) / 1000,
      threshold: 0.45,
      source: chance(0.7) ? "self" : "hr_photo",
    },
    location: {
      status: "inside",
      latitude: person.site.latitude + jitter(),
      longitude: person.site.longitude + jitter(),
      accuracyM: randomInt(4, 28),
      distanceM: randomInt(3, Math.max(4, person.site.radiusM - 20)),
      radiusM: person.site.radiusM,
      workLocation: person.site.name,
    },
  });
}

async function insertAttendance(
  client: PoolClient,
  people: SeedUser[],
  approverIds: string[],
): Promise<number> {
  const batch: unknown[] = [];
  const chunks: string[] = [];
  let count = 0;

  const flush = async (): Promise<void> => {
    if (chunks.length === 0) return;

    await client.query(
      `INSERT INTO attendances (
         employee_id, attendance_date, check_in, check_out, overtime_hours, status,
         edited_by, edited_at, edit_reason, check_in_verification, check_out_verification
       )
       VALUES ${chunks.join(", ")}
       ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
      batch,
    );

    chunks.length = 0;
    batch.length = 0;
  };

  for (const person of people) {
    const enrolled = chance(0.75);
    const punctuality = random();
    const absenteeism = 0.03 + random() * 0.07;

    for (let daysAgo = ATTENDANCE_DAYS; daysAgo >= 0; daysAgo--) {
      const date = addDays(TODAY, -daysAgo);

      if (daysAgo > person.joinedDaysAgo) continue;
      if (person.status === "inactive" && daysAgo < 30) continue;
      if (isWeekend(date) && !chance(daysAgo === 0 ? 0.5 : 0.07)) continue;

      const roll = random();
      let checkIn: Date | null = null;
      let checkOut: Date | null = null;
      let overtime = 0;
      let status: "present" | "absent" = "present";

      if (roll < (daysAgo === 0 ? absenteeism * 0.35 : absenteeism)) {
        status = "absent";
      } else {
        const baseHour = person.schedule.includes("07:00") ? 7
          : person.schedule.includes("10:00") ? 10
          : person.schedule.includes("13:00") ? 13
          : person.schedule.includes("22:00") ? 22
          : 9;
        const lateness = punctuality < 0.3 ? randomInt(-20, 5) : punctuality > 0.8 ? randomInt(5, 55) : randomInt(-10, 20);

        checkIn = atTime(date, baseHour, 0);
        checkIn = new Date(checkIn.getTime() + lateness * 60_000);

        const workedMinutes = randomInt(390, 640);
        checkOut = new Date(checkIn.getTime() + workedMinutes * 60_000);
        overtime = Math.max(0, Math.round(((workedMinutes - 480) / 60) * 100) / 100);
      }

      const edited = status !== "absent" && chance(0.04);

      chunks.push(
        `($${batch.length + 1}, $${batch.length + 2}, $${batch.length + 3}, $${batch.length + 4}, $${batch.length + 5}, $${batch.length + 6}, $${batch.length + 7}, $${batch.length + 8}, $${batch.length + 9}, $${batch.length + 10}::jsonb, $${batch.length + 11}::jsonb)`,
      );

      batch.push(
        person.id,
        isoDate(date),
        checkIn,
        checkOut,
        overtime,
        status,
        edited ? pick(approverIds) : null,
        edited ? addDays(date, randomInt(1, 4)) : null,
        edited
          ? pick([
              "Employee forgot to check out; corrected from the door log.",
              "Biometric device outage, entry added manually.",
              "Approved work-from-home day recorded after the fact.",
              "Check-in time corrected after a shift swap.",
              "Client visit; hours confirmed by the reporting manager.",
            ])
          : null,
        checkIn ? verificationPayload(person, checkIn, enrolled) : null,
        checkOut ? verificationPayload(person, checkOut, enrolled) : null,
      );

      count++;

      if (chunks.length >= 400) await flush();
    }
  }

  await flush();

  return count;
}

function historyEntry(action: string, at: Date, actorId: string, reason?: string) {
  return {
    at: at.toISOString(),
    actorId,
    action,
    ...(reason ? { reason } : {}),
  };
}

type SeededAllocation = {
  id: string;
  amount: number;
  remaining: number;
  validFrom: Date;
  validTo: Date | null;
};

async function insertAllocations(
  client: PoolClient,
  people: SeedUser[],
  types: Map<string, { id: string; spec: TimeOffTypeSpec }>,
  approvers: string[],
): Promise<{ count: number; byEmployee: Map<string, Map<string, SeededAllocation[]>> }> {
  const byEmployee = new Map<string, Map<string, SeededAllocation[]>>();
  const currentYear = TODAY.getFullYear();
  let count = 0;

  for (const person of people) {
    const granted = new Map<string, SeededAllocation[]>();
    byEmployee.set(person.id, granted);

    for (const [code, { id: typeId, spec }] of types) {
      if (!spec.requiresAllocation) continue;
      if (code === "MATERNITY" && !chance(0.08)) continue;
      if (code === "PATERNITY" && !chance(0.1)) continue;
      if (code === "SABBATICAL" && !chance(0.05)) continue;

      for (const year of [currentYear - 1, currentYear]) {
        const yearEnd = new Date(year, 11, 31);
        if (addDays(TODAY, -person.joinedDaysAgo) > yearEnd) continue;

        const openEnded = code === "SABBATICAL";
        const validFrom = new Date(year, 0, 1);
        const validTo = openEnded ? null : yearEnd;

        const approver = pick(approvers);
        const submittedAt = year === currentYear
          ? addDays(validFrom, randomInt(0, 40))
          : addDays(validFrom, randomInt(0, 20));
        const decidedAt = addDays(submittedAt, randomInt(1, 5));

        const status = year < currentYear
          ? (chance(0.95) ? "approved" : "refused")
          : (chance(0.85) ? "approved" : chance(0.6) ? "pending" : "refused");

        const history = [historyEntry("Submitted", submittedAt, person.id)];

        if (status === "approved") {
          history.push(historyEntry("Approved", decidedAt, approver));
        } else if (status === "refused") {
          history.push(
            historyEntry("Refused", decidedAt, approver, "Balance already carried over from last year."),
          );
        }

        const amount = (spec.allocation ?? 10) + (code === "PTO" && chance(0.3) ? randomInt(1, 6) : 0);

        const result = await client.query<{ id: string }>(
          `INSERT INTO time_off_allocations (
             employee_id, type_id, amount, valid_from, valid_to, note, status, history, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
           RETURNING id`,
          [
            person.id,
            typeId,
            amount,
            isoDate(validFrom),
            validTo ? isoDate(validTo) : null,
            pick([
              "",
              `Annual grant for ${year}.`,
              "Pro-rated for the joining date.",
              "Carried forward from last year.",
              "Granted with the mid-year review.",
            ]),
            status,
            JSON.stringify(history),
            submittedAt,
          ],
        );

        count++;

        if (status !== "approved") continue;

        const list = granted.get(code) ?? [];
        list.push({
          id: result.rows[0].id,
          amount,
          remaining: amount,
          validFrom,
          validTo,
        });
        granted.set(code, list);
      }
    }
  }

  return { count, byEmployee };
}

function businessDaysFrom(start: Date, days: number): Date[] {
  const result: Date[] = [];
  let cursor = new Date(start);

  while (result.length < days) {
    if (!isWeekend(cursor)) result.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  return result;
}

function leaveLength(code: string, unit: "days" | "hours"): number {
  if (unit === "hours") return 1;
  if (code === "MATERNITY") return randomInt(60, 120);
  if (code === "SABBATICAL") return randomInt(20, 45);
  if (code === "BEREAVE") return randomInt(1, 3);
  return randomInt(1, 5);
}

function payingAllocation(
  allocations: SeededAllocation[] | undefined,
  days: Date[],
  duration: number,
): SeededAllocation | null {
  if (!allocations) return null;

  const first = days[0];
  const last = days[days.length - 1];

  return (
    allocations.find(
      (allocation) =>
        first >= allocation.validFrom &&
        (allocation.validTo === null || last <= allocation.validTo) &&
        allocation.remaining >= duration,
    ) ?? null
  );
}

async function insertTimeOffRequests(
  client: PoolClient,
  people: SeedUser[],
  types: Map<string, { id: string; spec: TimeOffTypeSpec }>,
  allocationsByEmployee: Map<string, Map<string, SeededAllocation[]>>,
  approvers: string[],
): Promise<number> {
  let count = 0;

  for (const person of people) {
    const granted = allocationsByEmployee.get(person.id) ?? new Map();
    const requestCount = randomInt(1, 6);

    let cursor = addDays(TODAY, -Math.min(person.joinedDaysAgo, randomInt(60, 380)));

    for (let i = 0; i < requestCount; i++) {
      cursor = addDays(cursor, randomInt(5, 45));

      const options: {
        code: string;
        entry: { id: string; spec: TimeOffTypeSpec };
        days: Date[];
        duration: number;
        hours: number;
        allocation: SeededAllocation | null;
      }[] = [];

      for (const [code, entry] of types) {
        const hourly = entry.spec.unit === "hours";
        const days = businessDaysFrom(cursor, leaveLength(code, entry.spec.unit));
        const hours = hourly ? randomInt(1, 4) : 0;
        const duration = hourly ? hours : days.length;

        if (!entry.spec.requiresAllocation) {
          options.push({ code, entry, days, duration, hours, allocation: null });
          continue;
        }

        const allocation = payingAllocation(granted.get(code), days, duration);

        if (allocation) {
          options.push({ code, entry, days, duration, hours, allocation });
        }
      }

      if (options.length === 0) break;

      const option = pick(options);
      const { code, entry, days, duration, hours, allocation } = option;
      const startsInFuture = days[0] > TODAY;

      const status = startsInFuture
        ? (chance(0.7) ? "pending" : chance(0.6) ? "approved" : "cancelled")
        : (chance(0.78) ? "approved" : chance(0.5) ? "refused" : "cancelled");

      const submittedAt = addDays(days[0], -randomInt(2, 21));
      const decidedAt = addDays(submittedAt, randomInt(1, 4));
      const approver = pick(approvers);

      const history = [historyEntry("Submitted", submittedAt, person.id)];

      if (status === "approved") {
        history.push(historyEntry("Approved", decidedAt, approver));
      } else if (status === "refused") {
        history.push(
          historyEntry("Refused", decidedAt, approver, pick([
            "Team coverage unavailable for those dates.",
            "Two others are already off that week.",
            "Falls inside the quarter-end freeze.",
            "Insufficient balance for the requested duration.",
          ])),
        );
      } else if (status === "cancelled") {
        history.push(historyEntry("Cancelled", decidedAt, person.id, "Plans changed."));
      }

      const hourly = entry.spec.unit === "hours";
      const charges = hourly
        ? [{ date: isoDate(days[0]), amount: hours }]
        : days.map((day) => ({ date: isoDate(day), amount: 1 }));
      const consumptions = status === "approved" && allocation
        ? charges.map((charge) => ({
            allocationId: allocation.id,
            date: charge.date,
            amount: charge.amount,
          }))
        : [];

      const startHour = randomInt(9, 13);

      await client.query(
        `INSERT INTO time_off_requests (
           employee_id, type_id, start_date, end_date, start_time, end_time,
           reason, unit, duration, charges, consumptions, status, history, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14, $14)`,
        [
          person.id,
          entry.id,
          isoDate(days[0]),
          isoDate(days[days.length - 1]),
          hourly ? `${String(startHour).padStart(2, "0")}:00` : "",
          hourly ? `${String(startHour + hours).padStart(2, "0")}:00` : "",
          pick(LEAVE_REASONS[code] ?? ["Personal reasons"]),
          entry.spec.unit,
          duration,
          JSON.stringify(charges),
          JSON.stringify(consumptions),
          status,
          JSON.stringify(history),
          submittedAt,
        ],
      );

      count++;

      if (allocation && (status === "approved" || status === "pending")) {
        allocation.remaining -= duration;
      }

      cursor = addDays(days[days.length - 1], 1);
    }
  }

  return count;
}

async function insertBankAccounts(client: PoolClient, people: SeedUser[]): Promise<number> {
  const banks = ["HDFC", "ICIC", "SBIN", "UTIB", "KKBK", "PUNB", "IDFB", "YESB"];
  let count = 0;

  for (const person of people) {
    await client.query(
      `INSERT INTO employee_bank_accounts (employee_id, account_number)
       VALUES ($1, $2)
       ON CONFLICT (employee_id) DO UPDATE SET account_number = EXCLUDED.account_number`,
      [person.id, `${pick(banks)}0${randomInt(100000, 999999)}${randomInt(1000, 9999)}`],
    );

    count++;
  }

  return count;
}

/**
 * New payruns scoped to just the new intake, alongside whatever payruns
 * seed.ts already created for the same months -- the two never touch the
 * same employee, so nothing here can collide with existing payslips.
 */
async function runPayroll(
  people: SeedUser[],
  structures: Map<string, string>,
  createdBy: string,
): Promise<{ payruns: number; payslips: number }> {
  let payruns = 0;
  let payslips = 0;

  const byStructure = new Map<string, Set<string>>();

  for (const person of people) {
    if (!byStructure.has(person.structure)) byStructure.set(person.structure, new Set());
    byStructure.get(person.structure)!.add(person.id);
  }

  for (let monthsAgo = PAYROLL_MONTHS; monthsAgo >= 0; monthsAgo--) {
    const period = monthRange(monthsAgo);

    for (const [structureName, structureId] of structures) {
      const members = byStructure.get(structureName);

      if (!members || members.size === 0) continue;

      const { employees } = await listEligibleEmployees({
        startDate: period.start,
        endDate: period.end,
        limit: 5000,
        offset: 0,
      });

      const employeeIds = employees
        .filter((employee) => members.has(employee.id))
        .map((employee) => employee.id);

      if (employeeIds.length === 0) continue;

      const payrun = await createPayrun(
        {
          name: `${structureName} - ${period.label} (Intake 2)`,
          structureId,
          startDate: period.start,
          endDate: period.end,
          employeeIds,
        },
        createdBy,
      );

      const inputs = await findPayrollComputeInputs(payrun.id, period.start, period.end);
      if (inputs.length !== employeeIds.length || inputs.some((input) =>
        input.employeeStatus !== "active" || !input.bankAccount.trim() ||
        !input.employeeEmail || input.applicableContracts !== 1 ||
        input.contractStatus !== "running" || !input.contractId ||
        input.openAttendances > 0 || input.overlappingPayslips > 0
      )) {
        throw new Error(`Invalid payroll inputs in ${payrun.name}`);
      }
      payruns++;

      if (monthsAgo === 0) continue;

      const computed = await computePayrun(payrun.id);
      if (computed.warnings.length > 0) {
        throw new Error(`Payroll warnings in ${payrun.name}: ${JSON.stringify(computed.warnings)}`);
      }
      payslips += employeeIds.length;

      if (monthsAgo === 1) continue;

      await validatePayrun(payrun.id);

      if (monthsAgo >= 3) {
        await markPayrunPaid(payrun.id);
      }
    }
  }

  return { payruns, payslips };
}

/** Only the caches that a newly inserted employee could make stale. */
async function invalidateListCaches(): Promise<void> {
  const patterns = [
    "users:*", "user:*",
    "employee-list:*", "employee-profile:*", "contract-list:*", "contract:*",
    "attendance-list:*", "attendance:*", "time-off-list:*", "time-off:*", "payroll:*",
  ];
  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  }
}

async function verifySeed(): Promise<void> {
  const { rows: [result] } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM payruns WHERE jsonb_array_length(warnings) > 0) AS payrun_warnings,
      (SELECT count(*)::int FROM payslips WHERE jsonb_array_length(warnings) > 0 OR net < 0) AS invalid_payslips,
      (SELECT count(*)::int FROM attendances WHERE check_in IS NOT NULL AND check_out IS NULL) AS open_attendances,
      (SELECT count(*)::int FROM users u LEFT JOIN employee_bank_accounts b ON b.employee_id = u.id
        WHERE u.status = 'active' AND COALESCE(b.account_number, '') = '') AS missing_bank_accounts,
      (SELECT count(*)::int FROM contracts a JOIN contracts b
        ON a.employee_id = b.employee_id AND a.id < b.id
        AND a.start_date <= b.end_date AND b.start_date <= a.end_date) AS overlapping_contracts
  `);
  if (Object.values(result).some((count) => count !== 0)) {
    throw new Error(`Additional seed verification failed: ${JSON.stringify(result)}`);
  }
  logger.info(result, "additional seed checks passed");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function seedAdditional(): Promise<void> {
  const startedAt = Date.now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const client = await pool.connect();

  let people: SeedUser[] = [];
  let state: ExistingState;
  let allocationSummary = {
    count: 0,
    byEmployee: new Map<string, Map<string, SeededAllocation[]>>(),
  };
  let counts = { contracts: 0, attendance: 0, requests: 0, accounts: 0 };

  try {
    await client.query("BEGIN");

    state = await loadExistingState(client);
    const startIndex = state.names.size;

    people = buildIntake(state);

    await insertPeople(client, people, state.roleId, passwordHash);
    logger.info(`seeded ${people.length} additional users`);

    await insertProfiles(client, people, startIndex);
    logger.info(`seeded ${people.length} additional employee profiles`);

    counts.contracts = await insertContracts(client, people);
    logger.info(`seeded ${counts.contracts} additional contracts`);

    counts.attendance = await insertAttendance(client, people, state.approverIds);
    logger.info(`seeded ${counts.attendance} additional attendance records`);

    allocationSummary = await insertAllocations(client, people, state.timeOffTypes, state.approverIds);
    logger.info(`seeded ${allocationSummary.count} additional time off allocations`);

    counts.requests = await insertTimeOffRequests(
      client,
      people,
      state.timeOffTypes,
      allocationSummary.byEmployee,
      state.approverIds,
    );
    logger.info(`seeded ${counts.requests} additional time off requests`);

    counts.accounts = await insertBankAccounts(client, people);
    logger.info(`seeded ${counts.accounts} additional employee bank accounts`);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const payroll = await runPayroll(people, state!.structures, state!.payrollOwnerId);
  logger.info(`seeded ${payroll.payruns} additional payruns with ${payroll.payslips} payslips`);

  await verifySeed();
  await invalidateListCaches();

  const seconds = Math.round((Date.now() - startedAt) / 100) / 10;

  logger.info(
    {
      users: people.length,
      contracts: counts.contracts,
      attendance: counts.attendance,
      timeOffAllocations: allocationSummary.count,
      timeOffRequests: counts.requests,
      bankAccounts: counts.accounts,
      payruns: payroll.payruns,
      payslips: payroll.payslips,
    },
    `additional seed complete in ${seconds}s`,
  );

  logger.info(`every new account signs in with the password: ${DEMO_PASSWORD}`);
}

seedAdditional()
  .then(async () => {
    await pool.end();
    redis.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, "additional seed failed");
    await pool.end().catch(() => undefined);
    redis.disconnect();
    process.exit(1);
  });
