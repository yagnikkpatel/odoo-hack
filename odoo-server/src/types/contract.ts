export const CONTRACT_STATUSES = ["running", "expired"] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
] as const;

export type ContractEmploymentType = (typeof CONTRACT_EMPLOYMENT_TYPES)[number];

export type ContractRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeAvatar: string | null;
  startDate: string;
  endDate: string;
  wage: number;
  status: ContractStatus;
  salaryStructureId: string | null;
  salaryStructureName: string | null;
  employmentType: ContractEmploymentType;
  createdAt: Date;
  updatedAt: Date;
};

export type ContractListResult = {
  contracts: ContractRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};
