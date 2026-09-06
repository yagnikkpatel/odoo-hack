import type { PoolClient } from "pg";
import type { ContractStatus } from "../../types/contract";

/** Insert the contract and its creation history in the caller's transaction. */
export async function seedContract(
  client: PoolClient,
  input: {
    employeeId: string;
    startDate: string;
    endDate: string;
    wage: number;
    status: ContractStatus;
    createdAt?: Date;
    updatedAt?: Date;
  },
): Promise<void> {
  await client.query(
    `WITH inserted AS (
       INSERT INTO contracts
         (employee_id, start_date, end_date, wage, status, currency, wage_period, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'INR', 'month', COALESCE($6, NOW()), COALESCE($7, NOW()))
       RETURNING *
     )
     INSERT INTO contract_history
       (contract_id, employee_id, action, changes, snapshot, changed_by, created_at)
     SELECT id, employee_id, 'created', '{}'::jsonb,
       jsonb_build_object(
         'employeeId', employee_id,
         'startDate', to_char(start_date, 'YYYY-MM-DD'),
         'endDate', to_char(end_date, 'YYYY-MM-DD'),
         'wage', wage,
         'status', status
       ), NULL, created_at
     FROM inserted`,
    [input.employeeId, input.startDate, input.endDate, input.wage, input.status,
      input.createdAt ?? null, input.updatedAt ?? null],
  );
}
