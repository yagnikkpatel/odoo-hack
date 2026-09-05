import type { FaceTemplateSource } from "./attendance";

export const MANAGER_ROLES = [
  "admin",
  "hr_manager",
  "hr_payroll_manager",
] as const;

export type ManagerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type EmployeeAccountOption = ManagerOption & {
  status: "active";
};

export type EmployeeDirectorySummary = {
  total: number;
  active: number;
  departments: number;
  locations: number;
  withManager: number;
  withoutManager: number;
};

export type ImageRef = {
  imageId: string;
  imageUrl: string;
};

export type EmployeeProfileRecord = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  jobPosition: string;
  contact: string;
  employeeImage?: ImageRef;
  department: string;
  managerId: string | null;
  managerName: string | null;
  workingSchedule: string;
  company: string;
  companyImage?: ImageRef;
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

export type EmployeeListResult = {
  employees: EmployeeProfileRecord[];
  summary: EmployeeDirectorySummary;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type StoredImage = {
  url: string;
  publicId: string;
};

export type EmployeeProfileImageIds = {
  employeeImagePublicId: string | null;
  companyImagePublicId: string | null;
};

export type EmployeeImages = {
  employeeImage?: ImageRef;
  companyImage?: ImageRef;
};
