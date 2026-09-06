/**
 * One-shot demo seed.
 *
 * Fills every module the API exposes -- accounts, org chart, contracts, half a
 * year of attendance, leave configuration and history, the payroll rule book,
 * and payruns walked through the real compute/validate/pay lifecycle -- so a
 * fresh database opens as a company mid-operation rather than as empty screens.
 *
 * Payroll is produced by calling the payroll service rather than by inserting
 * payslip rows: the figures, lines and warnings then match exactly what the
 * application would have calculated, and nothing can drift from the engine.
 *
 * Every generated value comes from one seeded PRNG, so re-running the script
 * reproduces the same company. It TRUNCATEs the module tables first (roles and
 * permissions are owned by the migrations and are left alone), which makes it
 * safe to re-run but destructive to anything already there -- it is a demo
 * seed, not a migration.
 *
 *   npm run seed:demo
 */

import bcrypt from "bcryptjs";
import { seedContract } from "./lib/seed-contract";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import {
  computePayrun,
  createPayrun,
  listEligibleEmployees,
  markPayrunPaid,
  validatePayrun,
} from "../services/payroll.service";

/** One password for every seeded account, so any row in the directory logs in. */
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "00000000";

/** bcrypt is deliberately slow; the shared password is hashed once and reused. */
const SALT_ROUNDS = 10;

/** Calendar depth of the attendance history, in days back from today. */
const ATTENDANCE_DAYS = 365;

/** Completed months of payroll to run, oldest first. */
const PAYROLL_MONTHS = 9;

const COMPANY = "NexaCorp Technologies Pvt. Ltd.";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

let randomState = 0x9e3779b9;

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

/** DATE columns are calendar days: format from local fields, never toISOString. */
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
// Reference data
// ---------------------------------------------------------------------------

type OfficeSite = {
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusM: number;
};

/** Real coordinates, so the attendance geofence reads as a genuine office. */
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
  headcount: number;
  /** Monthly INR wage band for an individual contributor in this department. */
  wage: [number, number];
  positions: string[];
};

/**
 * Twelve departments and roughly seventy distinct job titles: enough spread
 * that every directory filter, grouping and chart in the client has something
 * to separate.
 */
const DEPARTMENTS: DepartmentSpec[] = [
  {
    name: "Engineering",
    headcount: 48,
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
    headcount: 16,
    wage: [42000, 110000],
    positions: ["QA Engineer", "Senior QA Engineer", "Automation Test Engineer", "QA Lead", "Performance Test Engineer"],
  },
  {
    name: "Product",
    headcount: 14,
    wage: [70000, 210000],
    positions: ["Associate Product Manager", "Product Manager", "Senior Product Manager", "Group Product Manager", "Product Analyst", "Technical Program Manager"],
  },
  {
    name: "Design",
    headcount: 13,
    wage: [45000, 150000],
    positions: ["UI Designer", "UX Designer", "Product Designer", "Senior Product Designer", "Design Lead", "UX Researcher", "Motion Designer"],
  },
  {
    name: "Sales",
    headcount: 28,
    wage: [40000, 175000],
    positions: ["Sales Development Representative", "Account Executive", "Senior Account Executive", "Enterprise Account Executive", "Regional Sales Manager", "Sales Operations Analyst", "Solutions Consultant"],
  },
  {
    name: "Marketing",
    headcount: 17,
    wage: [38000, 145000],
    positions: ["Marketing Associate", "Content Strategist", "SEO Analyst", "Performance Marketing Manager", "Brand Manager", "Product Marketing Manager", "Events Coordinator"],
  },
  {
    name: "Customer Success",
    headcount: 22,
    wage: [32000, 120000],
    positions: ["Support Associate", "Senior Support Associate", "Support Team Lead", "Customer Success Manager", "Technical Account Manager", "Implementation Specialist"],
  },
  {
    name: "Finance",
    headcount: 15,
    wage: [45000, 185000],
    positions: ["Accounts Assistant", "Accountant", "Senior Accountant", "Financial Analyst", "FP&A Manager", "Treasury Analyst", "Finance Controller"],
  },
  {
    name: "Human Resources",
    headcount: 13,
    wage: [38000, 165000],
    positions: ["HR Associate", "HR Generalist", "Talent Acquisition Specialist", "Learning & Development Lead", "HR Business Partner", "People Operations Manager"],
  },
  {
    name: "Operations",
    headcount: 15,
    wage: [35000, 140000],
    positions: ["Operations Associate", "Operations Coordinator", "Operations Manager", "Facilities Manager", "Vendor Manager", "Procurement Specialist"],
  },
  {
    name: "Legal & Compliance",
    headcount: 8,
    wage: [60000, 200000],
    positions: ["Legal Associate", "Corporate Counsel", "Compliance Analyst", "Contracts Manager", "Data Protection Officer"],
  },
  {
    name: "Data & Analytics",
    headcount: 18,
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
  "Karthik", "Nandini",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Iyer", "Nair", "Reddy", "Menon", "Kulkarni",
  "Chatterjee", "Bose", "Desai", "Joshi", "Mehta", "Kapoor", "Malhotra",
  "Chauhan", "Sinha", "Bhatt", "Rao", "Pillai", "Gupta", "Agarwal", "Banerjee",
  "Deshpande", "Trivedi", "Shetty", "Ghosh", "Saxena", "Chopra", "Mukherjee",
];

const EMPLOYMENT_NOTES = [
  "Referred by an existing employee.",
  "Campus hire, 2024 graduate programme.",
  "Lateral hire from a competitor.",
  "Converted from a fixed-term contract.",
  "Internal transfer between departments.",
];

// ---------------------------------------------------------------------------
// Leave configuration
// ---------------------------------------------------------------------------

type TimeOffTypeSpec = {
  name: string;
  code: string;
  unit: "days" | "hours";
  requiresAllocation: boolean;
  approval: "manager" | "none";
  payroll: "paid" | "unpaid";
  description: string;
  /** Yearly allocation granted to each employee, when the type needs one. */
  allocation?: number;
};

const TIME_OFF_TYPES: TimeOffTypeSpec[] = [
  { name: "Paid Time Off", code: "PTO", unit: "days", requiresAllocation: true, approval: "manager", payroll: "paid", description: "Annual leave drawn from the yearly allocation.", allocation: 24 },
  { name: "Sick Leave", code: "SICK", unit: "days", requiresAllocation: false, approval: "manager", payroll: "paid", description: "Unplanned medical leave. No allocation required." },
  { name: "Casual Leave", code: "CASUAL", unit: "days", requiresAllocation: true, approval: "manager", payroll: "paid", description: "Short personal absences, approved by the reporting manager.", allocation: 12 },
  { name: "Comp Off", code: "COMPOFF", unit: "hours", requiresAllocation: true, approval: "manager", payroll: "paid", description: "Compensatory hours earned for weekend or on-call work.", allocation: 40 },
  { name: "Work From Home", code: "WFH", unit: "days", requiresAllocation: false, approval: "manager", payroll: "paid", description: "Approved remote working day. Counted, not deducted." },
  { name: "Maternity Leave", code: "MATERNITY", unit: "days", requiresAllocation: true, approval: "manager", payroll: "paid", description: "Statutory maternity leave under the Maternity Benefit Act.", allocation: 182 },
  { name: "Paternity Leave", code: "PATERNITY", unit: "days", requiresAllocation: true, approval: "manager", payroll: "paid", description: "Paid leave for new fathers.", allocation: 15 },
  { name: "Bereavement Leave", code: "BEREAVE", unit: "days", requiresAllocation: false, approval: "none", payroll: "paid", description: "Compassionate leave following a family bereavement." },
  { name: "Unpaid Leave", code: "UNPAID", unit: "days", requiresAllocation: false, approval: "manager", payroll: "unpaid", description: "Leave without pay. Deducted as loss of pay on the payslip." },
  { name: "Sabbatical", code: "SABBATICAL", unit: "days", requiresAllocation: true, approval: "manager", payroll: "unpaid", description: "Extended unpaid break for tenured employees.", allocation: 60 },
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
// Payroll configuration
// ---------------------------------------------------------------------------

type RuleSpec = {
  name: string;
  code: string;
  category: string;
  sequence: number;
  method: string;
  amount?: number;
  percentage?: number;
  base?: string;
  formula?: string;
  quantity?: number;
  active?: boolean;
};

const SALARY_RULES: RuleSpec[] = [
  { name: "Basic Salary", code: "BASIC", category: "basic", sequence: 1, method: "percentage", percentage: 50, base: "WAGE" },
  { name: "Stipend", code: "STIPEND", category: "basic", sequence: 2, method: "formula", formula: "WAGE" },
  { name: "Contractor Fee", code: "CFEE", category: "basic", sequence: 3, method: "formula", formula: "WAGE" },
  { name: "House Rent Allowance", code: "HRA", category: "allowance", sequence: 10, method: "percentage", percentage: 40, base: "BASIC" },
  { name: "Standard Allowance", code: "STD", category: "allowance", sequence: 20, method: "fixed", amount: 5000 },
  { name: "Conveyance Allowance", code: "CONV", category: "allowance", sequence: 25, method: "fixed", amount: 1600 },
  { name: "Meal Allowance", code: "MEAL", category: "allowance", sequence: 28, method: "fixed", amount: 100, quantity: 22 },
  { name: "Leave Travel Allowance", code: "LTA", category: "allowance", sequence: 30, method: "fixed", amount: 1500 },
  { name: "Internet Reimbursement", code: "NET_ALLOW", category: "allowance", sequence: 32, method: "fixed", amount: 1000 },
  { name: "Overtime Payout", code: "OT", category: "allowance", sequence: 35, method: "formula", formula: "OVERTIME_HOURS * 250" },
  { name: "Shift Allowance", code: "SHIFT", category: "allowance", sequence: 38, method: "fixed", amount: 2500 },
  { name: "Performance Bonus", code: "BONUS", category: "allowance", sequence: 40, method: "fixed", amount: 0 },
  { name: "Fixed Allowance", code: "FIX", category: "allowance", sequence: 50, method: "formula", formula: "WAGE - BASIC - HRA - STD - CONV - LTA - NET_ALLOW" },
  { name: "Gross Salary", code: "GROSS", category: "gross", sequence: 60, method: "formula", formula: "BASIC + HRA + STD + CONV + MEAL + LTA + NET_ALLOW + OT + BONUS + FIX" },
  { name: "Gross (Intern)", code: "GROSS_INT", category: "gross", sequence: 61, method: "formula", formula: "STIPEND + MEAL" },
  { name: "Loss of Pay", code: "LOP", category: "deduction", sequence: 70, method: "formula", formula: "GROSS / PERIOD_DAYS * UNPAID_DAYS" },
  { name: "Labour Welfare Fund", code: "LWF", category: "deduction", sequence: 75, method: "fixed", amount: 25 },
  { name: "Provident Fund", code: "PF", category: "deduction", sequence: 80, method: "percentage", percentage: 12, base: "BASIC" },
  { name: "ESIC", code: "ESIC", category: "deduction", sequence: 90, method: "percentage", percentage: 0.75, base: "GROSS" },
  { name: "Professional Tax", code: "PT", category: "deduction", sequence: 100, method: "fixed", amount: 200 },
  { name: "Income Tax (TDS)", code: "TDS", category: "deduction", sequence: 102, method: "percentage", percentage: 8, base: "GROSS" },
  { name: "Withholding Tax", code: "WHT", category: "deduction", sequence: 105, method: "percentage", percentage: 10, base: "CFEE" },
  { name: "Salary Advance Recovery", code: "ADVANCE", category: "deduction", sequence: 106, method: "fixed", amount: 0 },
  { name: "Employer PF Contribution", code: "PF_EMPR", category: "contribution", sequence: 108, method: "percentage", percentage: 12, base: "BASIC" },
  { name: "Employer ESIC Contribution", code: "ESIC_EMPR", category: "contribution", sequence: 109, method: "percentage", percentage: 3.25, base: "GROSS" },
  { name: "Gratuity Provision", code: "GRATUITY", category: "contribution", sequence: 110, method: "percentage", percentage: 4.81, base: "BASIC", active: false },
  { name: "Net Salary", code: "NET", category: "net", sequence: 120, method: "formula", formula: "GROSS - LOP - LWF - PF - ESIC - PT - TDS - ADVANCE" },
  { name: "Net Salary (Intern)", code: "NET_INT", category: "net", sequence: 121, method: "formula", formula: "GROSS_INT - PT" },
  { name: "Net Payable (Contractor)", code: "NET_CON", category: "net", sequence: 122, method: "formula", formula: "CFEE - WHT" },
];

type StructureSpec = { name: string; description: string; codes: string[] };

/**
 * A formula may only reference codes running in the same structure, so each
 * structure lists a self-contained set.
 */
const SALARY_STRUCTURES: StructureSpec[] = [
  {
    name: "Regular Salary",
    description: "Monthly salary for permanent employees, with full statutory deductions and employer contributions.",
    codes: ["BASIC", "HRA", "STD", "CONV", "MEAL", "LTA", "NET_ALLOW", "OT", "BONUS", "FIX", "GROSS", "LOP", "LWF", "PF", "ESIC", "PT", "TDS", "ADVANCE", "PF_EMPR", "ESIC_EMPR", "NET"],
  },
  {
    name: "Shift Operations Salary",
    description: "Regular salary plus a shift allowance for support and operations rosters.",
    codes: ["BASIC", "HRA", "STD", "CONV", "MEAL", "LTA", "NET_ALLOW", "OT", "SHIFT", "BONUS", "FIX", "GROSS", "LOP", "LWF", "PF", "ESIC", "PT", "TDS", "ADVANCE", "PF_EMPR", "ESIC_EMPR", "NET"],
  },
  {
    name: "Intern Stipend",
    description: "Flat stipend with a meal allowance and no statutory contributions.",
    codes: ["STIPEND", "MEAL", "GROSS_INT", "PT", "NET_INT"],
  },
  {
    name: "Contractor",
    description: "Full contract fee with tax withheld at source.",
    codes: ["CFEE", "WHT", "NET_CON"],
  },
  {
    name: "Executive Salary",
    description: "Leadership structure with a higher basic share and no overtime component.",
    codes: ["BASIC", "HRA", "STD", "LTA", "NET_ALLOW", "BONUS", "FIX", "GROSS", "LOP", "PF", "PT", "TDS", "PF_EMPR", "NET"],
  },
];

// SHIFT is referenced only by the shift structure; FIX subtracts the same terms
// in both, so the two never disagree on take-home for the same wage.

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "hr_manager" | "hr_payroll_manager" | "hr_payroll_user" | "employee";
  status: "active" | "inactive";
  department: string;
  jobPosition: string;
  site: OfficeSite;
  schedule: string;
  wage: number;
  /** Which salary structure this person is paid on. */
  structure: string;
  managerId: string | null;
  joinedDaysAgo: number;
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

function contactNumber(index: number): string {
  return `+91 ${String(90000 + (index * 137) % 9999).slice(0, 5)} ${String(10000 + (index * 911) % 89999).slice(0, 5)}`;
}

/** A 128-float face template in the shape the verification engine stores. */
function faceDescriptor(): number[] {
  return Array.from({ length: 128 }, () => Math.round((random() * 2 - 1) * 1e6) / 1e6);
}

/**
 * Rosters follow the job, not the dice: support and operations run shifts,
 * interns keep intern hours, and contractors work flexibly.
 */
function scheduleFor(department: string, jobPosition: string): string {
  if (jobPosition.includes("Intern")) return SCHEDULES[9];
  if (jobPosition.startsWith("Contract")) return SCHEDULES[7];

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

  // A few genuinely part-time roles elsewhere in the company.
  return chance(0.05) ? SCHEDULES[6] : pick([SCHEDULES[0], SCHEDULES[0], SCHEDULES[1]]);
}

function structureFor(department: string, jobPosition: string, wage: number): string {
  if (jobPosition.includes("Intern")) return "Intern Stipend";
  if (wage >= 165000) return "Executive Salary";
  if (department === "Customer Success" || department === "Operations") return "Shift Operations Salary";
  return "Regular Salary";
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

/**
 * Roles and permissions are created and granted by the migrations, so they are
 * left in place; everything a seed owns is cleared and rebuilt.
 */
async function reset(client: PoolClient): Promise<void> {
  await client.query(`
    TRUNCATE
      payslip_deliveries,
      payslips,
      payrun_employees,
      payruns,
      salary_structure_rules,
      salary_structures,
      salary_rules,
      time_off_requests,
      time_off_allocations,
      time_off_types,
      attendances,
      contract_history,
      contracts,
      employee_bank_accounts,
      employee_profiles,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function roleIds(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM roles",
  );

  return new Map(result.rows.map((row) => [row.name, row.id]));
}

function buildPeople(): SeedUser[] {
  const people: SeedUser[] = [];
  const names = new Set<string>();
  const emails = new Set<string>();

  const push = (
    partial: Omit<SeedUser, "id" | "email" | "structure"> & { email?: string },
  ): SeedUser => {
    const email = partial.email ?? slugEmail(partial.name, emails);
    emails.add(email);
    const person: SeedUser = {
      ...partial,
      id: "",
      email,
      structure: structureFor(partial.department, partial.jobPosition, partial.wage),
    };
    people.push(person);
    return person;
  };

  // Leadership first, so everyone else can report into somebody.
  names.add("Yagnik Patel");
  const admin = push({
    name: "Yagnik Patel",
    email: "admin@peoplepay360.com",
    role: "admin",
    status: "active",
    department: "Operations",
    jobPosition: "Chief Operating Officer",
    site: SITES[0],
    schedule: SCHEDULES[0],
    wage: 320000,
    managerId: null,
    joinedDaysAgo: 1500,
  });

  const hrHead = push({
    name: uniqueName(names),
    email: "hr@peoplepay360.com",
    role: "hr_manager",
    status: "active",
    department: "Human Resources",
    jobPosition: "Head of People",
    site: SITES[0],
    schedule: SCHEDULES[0],
    wage: 245000,
    managerId: null,
    joinedDaysAgo: 1300,
  });

  const payrollHead = push({
    name: uniqueName(names),
    email: "payroll@peoplepay360.com",
    role: "hr_payroll_manager",
    status: "active",
    department: "Finance",
    jobPosition: "Payroll Director",
    site: SITES[0],
    schedule: SCHEDULES[0],
    wage: 235000,
    managerId: null,
    joinedDaysAgo: 1250,
  });

  push({
    name: uniqueName(names),
    email: "payroll.user@peoplepay360.com",
    role: "hr_payroll_user",
    status: "active",
    department: "Finance",
    jobPosition: "Payroll Specialist",
    site: SITES[1],
    schedule: SCHEDULES[0],
    wage: 96000,
    managerId: null,
    joinedDaysAgo: 900,
  });

  // Five more HR managers, one per major site, to spread approvals around.
  for (let i = 0; i < 5; i++) {
    push({
      name: uniqueName(names),
      role: "hr_manager",
      status: "active",
      department: "Human Resources",
      jobPosition: pick(["HR Business Partner", "People Operations Manager", "Regional HR Manager", "Talent Partner"]),
      site: SITES[(i + 1) % SITES.length],
      schedule: pick(SCHEDULES.slice(0, 3)),
      wage: randomInt(110000, 180000),
      managerId: null,
      joinedDaysAgo: randomInt(400, 1200),
    });
  }

  // Payroll back office.
  for (let i = 0; i < 2; i++) {
    push({
      name: uniqueName(names),
      role: "hr_payroll_manager",
      status: "active",
      department: "Finance",
      jobPosition: pick(["Payroll Manager", "Senior Payroll Manager", "Payroll Operations Manager"]),
      site: SITES[(i + 2) % SITES.length],
      schedule: SCHEDULES[0],
      wage: randomInt(140000, 195000),
      managerId: null,
      joinedDaysAgo: randomInt(400, 1100),
    });
  }

  for (let i = 0; i < 4; i++) {
    push({
      name: uniqueName(names),
      role: "hr_payroll_user",
      status: "active",
      department: "Finance",
      jobPosition: pick(["Payroll Specialist", "Payroll Associate", "Payroll Coordinator", "Payroll Analyst"]),
      site: SITES[(i + 3) % SITES.length],
      schedule: pick(SCHEDULES.slice(0, 4)),
      wage: randomInt(58000, 105000),
      managerId: null,
      joinedDaysAgo: randomInt(200, 900),
    });
  }

  // One recognisable employee login, then the rest of the company.
  push({
    name: uniqueName(names),
    email: "employee@peoplepay360.com",
    role: "employee",
    status: "active",
    department: "Engineering",
    jobPosition: "Senior Software Engineer",
    site: SITES[0],
    schedule: SCHEDULES[0],
    wage: 142000,
    managerId: null,
    joinedDaysAgo: 780,
  });

  for (const department of DEPARTMENTS) {
    for (let i = 0; i < department.headcount; i++) {
      const jobPosition = i === 0
        ? department.positions[department.positions.length - 1]
        : pick(department.positions);
      const seniority = department.positions.indexOf(jobPosition) / department.positions.length;
      const [minWage, maxWage] = department.wage;
      const wage = Math.round(
        (minWage + (maxWage - minWage) * (0.25 + seniority * 0.75) * (0.85 + random() * 0.3)) / 500,
      ) * 500;

      push({
        name: uniqueName(names),
        role: "employee",
        // A handful of leavers, so the directory has an inactive filter worth using.
        status: chance(0.06) ? "inactive" : "active",
        department: department.name,
        jobPosition,
        site: pick(SITES),
        schedule: scheduleFor(department.name, jobPosition),
        wage: Math.max(minWage, Math.min(maxWage, wage)),
        managerId: null,
        joinedDaysAgo: randomInt(40, 1600),
      });
    }
  }

  // Two interns and two contractors, so every salary structure gets a payrun.
  for (let i = 0; i < 2; i++) {
    push({
      name: uniqueName(names),
      role: "employee",
      status: "active",
      department: "Engineering",
      jobPosition: "Engineering Intern",
      site: SITES[i % SITES.length],
      schedule: SCHEDULES[9],
      wage: 25000,
      managerId: null,
      joinedDaysAgo: randomInt(60, 260),
    });
  }

  for (let i = 0; i < 3; i++) {
    const contractor = push({
      name: uniqueName(names),
      role: "employee",
      status: "active",
      department: pick(["Design", "Data & Analytics", "Marketing"]),
      jobPosition: pick(["Contract Designer", "Contract Data Engineer", "Contract Copywriter"]),
      site: SITES[9],
      schedule: SCHEDULES[7],
      wage: randomInt(90000, 180000),
      managerId: null,
      joinedDaysAgo: randomInt(90, 500),
    });
    contractor.structure = "Contractor";
  }

  void admin;
  void hrHead;
  void payrollHead;

  return people;
}

async function insertPeople(
  client: PoolClient,
  people: SeedUser[],
  roles: Map<string, string>,
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
        roles.get(person.role),
        person.status,
        addDays(TODAY, -person.joinedDaysAgo),
      ],
    );

    person.id = result.rows[0].id;
  }

  // Reporting lines are assigned once every id exists: department heads report
  // to leadership, everybody else to the head of their own department.
  const leadership = people.filter((person) => person.role !== "employee");
  const headByDepartment = new Map<string, SeedUser>();

  for (const person of people) {
    if (person.role === "employee" && !headByDepartment.has(person.department)) {
      headByDepartment.set(person.department, person);
    }
  }

  for (const [index, person] of people.entries()) {
    if (person.role === "admin") continue;

    const head = headByDepartment.get(person.department);
    const manager = person.role !== "employee" || head === person
      ? leadership[index % leadership.length]
      : (head ?? leadership[0]);

    person.managerId = manager.id === person.id ? null : manager.id;
  }
}

async function insertProfiles(client: PoolClient, people: SeedUser[]): Promise<void> {
  for (const [index, person] of people.entries()) {
    // Face enrolment covers most of the company, so attendance verification has
    // both enrolled and not-yet-enrolled employees to show.
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
        contactNumber(index),
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
        enrolled ? addDays(TODAY, -randomInt(20, 400)) : null,
      ],
    );
  }
}

/**
 * Every employee gets a running contract that covers the payroll window, plus
 * an expired predecessor for anyone who has been here long enough to have had
 * a raise -- so contract history is browsable, not just a single row each.
 */
async function insertContracts(client: PoolClient, people: SeedUser[]): Promise<number> {
  let count = 0;

  for (const person of people) {
    const tenure = person.joinedDaysAgo;
    const joined = addDays(TODAY, -tenure);

    // Prior contracts, oldest first, each at a lower wage than the next.
    const priorContracts = tenure > 400 ? (tenure > 900 ? 2 : 1) : 0;
    let cursor = joined;

    for (let i = 0; i < priorContracts; i++) {
      const end = addDays(cursor, randomInt(300, 420));
      const factor = 0.72 + i * 0.12;

      await seedContract(client, {
        employeeId: person.id,
        startDate: isoDate(cursor),
        endDate: isoDate(end),
        wage: Math.round(person.wage * factor),
        status: "expired",
        createdAt: cursor,
        updatedAt: end,
      });

      count++;
      cursor = addDays(end, 1);
    }

    // The running contract has to start before the oldest payroll period and
    // run past today, or payroll would find nobody eligible.
    const runningStart = priorContracts > 0
      ? cursor
      : addDays(joined, 0);
    const earliestPayroll = new Date(TODAY.getFullYear(), TODAY.getMonth() - PAYROLL_MONTHS, 1);
    const start = runningStart > earliestPayroll && tenure < 240
      ? runningStart
      : (runningStart > earliestPayroll ? earliestPayroll : runningStart);

    // Inactive employees have left: their last contract has already expired.
    if (person.status === "inactive") {
      const leftOn = addDays(TODAY, -randomInt(5, 90));

      await seedContract(client, {
        employeeId: person.id,
        startDate: isoDate(start),
        endDate: isoDate(leftOn),
        wage: person.wage,
        status: "expired",
        createdAt: start,
        updatedAt: leftOn,
      });
      count++;
      continue;
    }

    await seedContract(client, {
      employeeId: person.id,
      startDate: isoDate(start),
      endDate: isoDate(addDays(TODAY, randomInt(200, 900))),
      wage: person.wage,
      status: "running",
      createdAt: start,
    });
    count++;
  }

  return count;
}

function verificationPayload(
  person: SeedUser,
  at: Date,
  enrolled: boolean,
): string | null {
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

/**
 * Half a year of daily attendance. Rows are written in batches: one row per
 * employee per business day is the single largest table in the seed.
 */
async function insertAttendance(
  client: PoolClient,
  people: SeedUser[],
  hrManagerIds: string[],
): Promise<number> {
  const columns = 11;
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
    // Punctuality is a property of the person, not of the day: some people are
    // reliably early, some reliably late.
    const punctuality = random();
    const absenteeism = 0.03 + random() * 0.07;

    for (let daysAgo = ATTENDANCE_DAYS; daysAgo >= 0; daysAgo--) {
      const date = addDays(TODAY, -daysAgo);

      if (daysAgo > person.joinedDaysAgo) continue;
      if (person.status === "inactive" && daysAgo < 30) continue;

      // Weekends are quiet rather than empty -- a small on-call crew works them,
      // which is also what earns the comp-off balances. Today is always busy,
      // weekend or not, so the live attendance board is never blank.
      if (isWeekend(date) && !chance(daysAgo === 0 ? 0.5 : 0.07)) continue;

      const roll = random();
      let checkIn: Date | null = null;
      let checkOut: Date | null = null;
      let overtime = 0;
      let status: "present" | "absent" | "incomplete" = "present";

      // Today is a working day in progress, so it carries far fewer absences
      // than a settled historical day.
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

        // Today's row stays open for everyone still at their desk: the live
        // attendance board is built around these in-progress sessions.
        if (daysAgo === 0 && chance(0.62)) {
          status = "incomplete";
        } else if (roll < absenteeism + 0.03) {
          status = "incomplete";
        } else {
          const workedMinutes = randomInt(390, 640);
          checkOut = new Date(checkIn.getTime() + workedMinutes * 60_000);
          overtime = Math.max(0, Math.round(((workedMinutes - 480) / 60) * 100) / 100);
        }
      }

      // A small share of rows were corrected afterwards by an HR manager.
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
        edited ? pick(hrManagerIds) : null,
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

async function insertTimeOffTypes(
  client: PoolClient,
): Promise<Map<string, { id: string; spec: TimeOffTypeSpec }>> {
  const byCode = new Map<string, { id: string; spec: TimeOffTypeSpec }>();

  for (const spec of TIME_OFF_TYPES) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO time_off_types (name, code, unit, requires_allocation, approval, payroll, active, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        spec.name,
        spec.code,
        spec.unit,
        spec.requiresAllocation,
        spec.approval,
        spec.payroll,
        spec.code !== "SABBATICAL",
        spec.description,
      ],
    );

    byCode.set(spec.code, { id: result.rows[0].id, spec });
  }

  return byCode;
}

function historyEntry(action: string, at: Date, actorId: string, reason?: string) {
  return {
    at: at.toISOString(),
    actorId,
    action,
    ...(reason ? { reason } : {}),
  };
}

/**
 * A granted allocation, tracked in memory so requests can draw it down without
 * ever exceeding the balance or reaching outside its validity window.
 */
type SeededAllocation = {
  id: string;
  amount: number;
  remaining: number;
  validFrom: Date;
  validTo: Date | null;
};

/**
 * Allocations are granted per calendar year, for the previous year as well as
 * the current one, so that leave taken anywhere in the seeded history has a
 * grant that actually covers its dates. Only approved allocations are handed
 * back for requests to draw on -- a pending or refused grant confers no balance.
 */
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
      // Parental and sabbatical grants are made case by case, not company-wide.
      if (code === "MATERNITY" && !chance(0.08)) continue;
      if (code === "PATERNITY" && !chance(0.1)) continue;
      if (code === "SABBATICAL" && !chance(0.05)) continue;

      for (const year of [currentYear - 1, currentYear]) {
        // Nobody is granted leave for a year they had not joined by.
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

        // Last year's grants are all settled; this year still has a few in the
        // approval queue, and the occasional refusal.
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

/** How long a leave of this type typically runs, in working days. */
function leaveLength(code: string, unit: "days" | "hours"): number {
  if (unit === "hours") return 1;
  if (code === "MATERNITY") return randomInt(60, 120);
  if (code === "SABBATICAL") return randomInt(20, 45);
  if (code === "BEREAVE") return randomInt(1, 3);
  return randomInt(1, 5);
}

/**
 * The allocation that can actually pay for a leave: it has to be approved, its
 * window has to contain every charged day, and it has to have enough balance
 * left. Returns null when the employee simply cannot take this leave -- which
 * is the point, since a leave that needs an allocation and has none is not a
 * leave anyone could have booked.
 */
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

/**
 * Leave history. Each employee's requests are laid down on a cursor that walks
 * forward past the end of the previous one, so no two ever cover the same day,
 * and a type that requires an allocation is only ever offered when a grant
 * covering those exact dates still has the balance to pay for it.
 */
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
    const requestCount = randomInt(3, 9);

    // Start early in the seeded history, but never before the joining date.
    let cursor = addDays(TODAY, -Math.min(person.joinedDaysAgo, randomInt(300, 430)));

    for (let i = 0; i < requestCount; i++) {
      cursor = addDays(cursor, randomInt(5, 45));

      // Offer only the types this employee could genuinely have booked on
      // these dates: free types always, allocation-backed types only when a
      // grant covers the dates and still has the balance.
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

      // Future-dated leave is mostly still awaiting a decision; past leave has one.
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

      // Approved and pending leave both hold balance: a pending request is a
      // claim on the allocation that nothing else may spend twice.
      if (allocation && (status === "approved" || status === "pending")) {
        allocation.remaining -= duration;
      }

      // The next request has to begin after this one ends.
      cursor = addDays(days[days.length - 1], 1);
    }
  }

  return count;
}

async function insertSalaryConfiguration(
  client: PoolClient,
): Promise<{ rules: number; structures: Map<string, string> }> {
  const ruleIds = new Map<string, string>();

  for (const rule of SALARY_RULES) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO salary_rules
         (name, code, category, sequence, method, amount, percentage, base, formula, quantity, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        rule.name,
        rule.code,
        rule.category,
        rule.sequence,
        rule.method,
        rule.amount ?? 0,
        rule.percentage ?? 0,
        rule.base ?? "",
        rule.formula ?? "",
        rule.quantity ?? 1,
        rule.active ?? true,
      ],
    );

    ruleIds.set(rule.code, result.rows[0].id);
  }

  const structures = new Map<string, string>();

  for (const structure of SALARY_STRUCTURES) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO salary_structures (name, description) VALUES ($1, $2) RETURNING id`,
      [structure.name, structure.description],
    );

    const structureId = result.rows[0].id;
    structures.set(structure.name, structureId);

    await client.query(
      `INSERT INTO salary_structure_rules (structure_id, rule_id)
       SELECT $1, unnest($2::uuid[])`,
      [structureId, structure.codes.map((code) => ruleIds.get(code))],
    );
  }

  return { rules: ruleIds.size, structures };
}

async function insertBankAccounts(
  client: PoolClient,
  people: SeedUser[],
): Promise<{ count: number; missing: Set<string> }> {
  const banks = ["HDFC", "ICIC", "SBIN", "UTIB", "KKBK", "PUNB", "IDFB", "YESB"];
  const missing = new Set<string>();
  let count = 0;

  for (const person of people) {
    // A couple of accounts are deliberately missing, so the payroll screen has
    // a real blocking warning to show. Payroll keeps those employees out of the
    // months it settles, exactly as an operator would.
    if (chance(0.03)) {
      missing.add(person.id);
      continue;
    }

    await client.query(
      `INSERT INTO employee_bank_accounts (employee_id, account_number)
       VALUES ($1, $2)
       ON CONFLICT (employee_id) DO UPDATE SET account_number = EXCLUDED.account_number`,
      [person.id, `${pick(banks)}0${randomInt(100000, 999999)}${randomInt(1000, 9999)}`],
    );

    count++;
  }

  return { count, missing };
}

/**
 * Payruns are created and advanced through the real service, so the payslips,
 * their lines and their warnings are exactly what the application computes.
 * Older months are paid, the most recent completed month is only computed, and
 * the current month sits in draft.
 */
async function runPayroll(
  people: SeedUser[],
  structures: Map<string, string>,
  createdBy: string,
  missingBankAccounts: Set<string>,
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
        limit: 500,
        offset: 0,
      });

      const employeeIds = employees
        .filter((employee) => members.has(employee.id))
        // An employee with no payment account can be drafted but never settled,
        // so they only appear on the open month.
        .filter((employee) => monthsAgo === 0 || !missingBankAccounts.has(employee.id))
        .map((employee) => employee.id);

      if (employeeIds.length === 0) continue;

      const payrun = await createPayrun(
        {
          name: `${structureName} - ${period.label}`,
          structureId,
          startDate: period.start,
          endDate: period.end,
          employeeIds,
        },
        createdBy,
      );

      payruns++;

      // The current month stays in draft: it is the one an operator would open.
      if (monthsAgo === 0) continue;

      const computed = await computePayrun(payrun.id);
      payslips += employeeIds.length;

      if (monthsAgo === 1) continue;

      // Validation refuses to lock a payrun that still has blocking warnings --
      // a missing bank account, for instance -- so those months stay computed.
      if (computed.warnings.some((warning) => warning.blocking)) continue;

      await validatePayrun(payrun.id);

      if (monthsAgo >= 3) {
        await markPayrunPaid(payrun.id);
      }
    }
  }

  return { payruns, payslips };
}

/**
 * Delivery rows for the payslips that were actually paid out, including the
 * failures an operator would need to chase.
 */
async function insertDeliveries(client: PoolClient, queuedBy: string): Promise<number> {
  const { rows } = await client.query<{
    id: string;
    payrunId: string;
    employeeId: string;
    email: string;
    paidAt: string | null;
  }>(
    `SELECT p.id, p.payrun_id AS "payrunId", p.employee_id AS "employeeId",
            p.employee_email AS "email", r.paid_at AS "paidAt"
     FROM payslips p
     JOIN payruns r ON r.id = p.payrun_id
     WHERE p.status IN ('validated', 'paid')`,
  );

  let count = 0;

  for (const payslip of rows) {
    const queuedAt = payslip.paidAt ? new Date(payslip.paidAt) : addDays(TODAY, -randomInt(5, 40));
    const roll = random();
    const status = roll < 0.88 ? "sent" : roll < 0.96 ? "failed" : "queued";

    await client.query(
      `INSERT INTO payslip_deliveries (
         payslip_id, payrun_id, employee_id, recipient, status, attempts, error,
         job_id, message_id, queued_by, queued_at, sent_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (payslip_id) DO NOTHING`,
      [
        payslip.id,
        payslip.payrunId,
        payslip.employeeId,
        payslip.email,
        status,
        status === "failed" ? randomInt(2, 5) : 1,
        status === "failed"
          ? pick([
              "550 5.1.1 recipient address rejected: user unknown",
              "SMTP timeout after 30s",
              "451 4.7.1 greylisted, try again later",
              "Mailbox full",
            ])
          : "",
        `payslip:${payslip.id.slice(0, 8)}`,
        status === "sent" ? `<${payslip.id}@peoplepay360.com>` : "",
        queuedBy,
        queuedAt,
        status === "sent" ? new Date(queuedAt.getTime() + randomInt(2, 240) * 1000) : null,
      ],
    );

    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const startedAt = Date.now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const people = buildPeople();
  const client = await pool.connect();

  let allocationSummary = {
    count: 0,
    byEmployee: new Map<string, Map<string, SeededAllocation[]>>(),
  };
  let missingBankAccounts = new Set<string>();
  let types: Map<string, { id: string; spec: TimeOffTypeSpec }>;
  let structures: Map<string, string>;
  let counts = {
    users: 0,
    contracts: 0,
    attendance: 0,
    requests: 0,
    rules: 0,
    accounts: 0,
  };

  try {
    await client.query("BEGIN");

    await reset(client);

    const roles = await roleIds(client);

    for (const role of ["admin", "hr_manager", "hr_payroll_manager", "hr_payroll_user", "employee"]) {
      if (!roles.has(role)) {
        throw new Error(`role not found: ${role} -- run "npm run migrate" first`);
      }
    }

    await insertPeople(client, people, roles, passwordHash);
    counts.users = people.length;
    logger.info(`seeded ${people.length} users`);

    await insertProfiles(client, people);
    logger.info(`seeded ${people.length} employee profiles`);

    counts.contracts = await insertContracts(client, people);
    logger.info(`seeded ${counts.contracts} contracts`);

    const hrManagerIds = people
      .filter((person) => person.role === "hr_manager" || person.role === "admin")
      .map((person) => person.id);

    counts.attendance = await insertAttendance(client, people, hrManagerIds);
    logger.info(`seeded ${counts.attendance} attendance records`);

    types = await insertTimeOffTypes(client);
    logger.info(`seeded ${types.size} time off types`);

    allocationSummary = await insertAllocations(client, people, types, hrManagerIds);
    logger.info(`seeded ${allocationSummary.count} time off allocations`);

    counts.requests = await insertTimeOffRequests(
      client,
      people,
      types,
      allocationSummary.byEmployee,
      hrManagerIds,
    );
    logger.info(`seeded ${counts.requests} time off requests`);

    const configuration = await insertSalaryConfiguration(client);
    structures = configuration.structures;
    counts.rules = configuration.rules;
    logger.info(`seeded ${counts.rules} salary rules across ${structures.size} salary structures`);

    const accounts = await insertBankAccounts(client, people);
    counts.accounts = accounts.count;
    missingBankAccounts = accounts.missing;
    logger.info(`seeded ${counts.accounts} employee bank accounts`);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Payroll runs outside the transaction above: it goes through the payroll
  // service, which owns its own connections and cache invalidation.
  const payrollOwner = people.find((person) => person.role === "hr_payroll_manager")!;
  const payroll = await runPayroll(
    people,
    structures!,
    payrollOwner.id,
    missingBankAccounts,
  );
  logger.info(`seeded ${payroll.payruns} payruns with ${payroll.payslips} payslips`);

  const deliveryClient = await pool.connect();
  let deliveries = 0;

  try {
    deliveries = await insertDeliveries(deliveryClient, payrollOwner.id);
  } finally {
    deliveryClient.release();
  }

  logger.info(`seeded ${deliveries} payslip deliveries`);

  const seconds = Math.round((Date.now() - startedAt) / 100) / 10;

  logger.info(
    {
      users: counts.users,
      profiles: counts.users,
      contracts: counts.contracts,
      contractHistory: counts.contracts,
      attendance: counts.attendance,
      timeOffTypes: TIME_OFF_TYPES.length,
      timeOffAllocations: allocationSummary.count,
      timeOffRequests: counts.requests,
      salaryRules: counts.rules,
      salaryStructures: SALARY_STRUCTURES.length,
      bankAccounts: counts.accounts,
      payruns: payroll.payruns,
      payslips: payroll.payslips,
      payslipDeliveries: deliveries,
    },
    `demo seed complete in ${seconds}s`,
  );

  logger.info(`every account signs in with the password: ${DEMO_PASSWORD}`);
  logger.info("admin@peoplepay360.com | hr@peoplepay360.com | payroll@peoplepay360.com | payroll.user@peoplepay360.com | employee@peoplepay360.com");
}

seed()
  .then(async () => {
    await pool.end();
    redis.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, "seed-demo failed");
    await pool.end().catch(() => undefined);
    redis.disconnect();
    process.exit(1);
  });
