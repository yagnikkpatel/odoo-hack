import { pool } from "../lib/db";
import {
  ContractHistoryAction,
  ContractHistoryChange,
  ContractHistoryEntry,
  ContractHistorySnapshot,
} from "../types/contract";

export async function insertContractHistory(entry: {
  contractId: string;
  employeeId: string;
  action: ContractHistoryAction;
  changes: Record<string, ContractHistoryChange>;
  snapshot: ContractHistorySnapshot;
  changedBy: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO contract_history
       (contract_id, employee_id, action, changes, snapshot, changed_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      entry.contractId,
      entry.employeeId,
      entry.action,
      JSON.stringify(entry.changes),
      JSON.stringify(entry.snapshot),
      entry.changedBy,
    ],
  );
}

const HISTORY_COLUMNS = `
  h.id AS "id",
  h.contract_id AS "contractId",
  h.employee_id AS "employeeId",
  h.action AS "action",
  h.changes AS "changes",
  h.snapshot AS "snapshot",
  h.changed_by AS "changedBy",
  u.name AS "changedByName",
  h.created_at AS "createdAt"
`;

const HISTORY_FROM = `
  FROM contract_history h
  LEFT JOIN users u ON u.id = h.changed_by
`;

export async function findContractHistory(
  contractId: string,
): Promise<ContractHistoryEntry[]> {
  const result = await pool.query<ContractHistoryEntry>(
    `SELECT ${HISTORY_COLUMNS} ${HISTORY_FROM}
     WHERE h.contract_id = $1
     ORDER BY h.created_at DESC`,
    [contractId],
  );

  return result.rows;
}

export async function findContractHistoryByEmployeeId(
  employeeId: string,
): Promise<ContractHistoryEntry[]> {
  const result = await pool.query<ContractHistoryEntry>(
    `SELECT ${HISTORY_COLUMNS} ${HISTORY_FROM}
     WHERE h.employee_id = $1
     ORDER BY h.created_at DESC`,
    [employeeId],
  );

  return result.rows;
}
