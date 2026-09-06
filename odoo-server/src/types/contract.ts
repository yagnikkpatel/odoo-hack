export const CONTRACT_STATUSES = ["running", "expired"] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

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

export const CONTRACT_HISTORY_ACTIONS = ["created", "updated", "deleted"] as const;

export type ContractHistoryAction = (typeof CONTRACT_HISTORY_ACTIONS)[number];

export type ContractHistoryChange = {
  old: unknown;
  new: unknown;
};

export type ContractHistorySnapshot = {
  employeeId: string;
  startDate: string;
  endDate: string;
  wage: number;
  status: ContractStatus;
};

export type ContractHistoryEntry = {
  id: string;
  contractId: string;
  employeeId: string;
  action: ContractHistoryAction;
  changes: Record<string, ContractHistoryChange>;
  snapshot: ContractHistorySnapshot;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: Date;
};
