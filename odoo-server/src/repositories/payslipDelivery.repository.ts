import { pool } from "../lib/db";
import {
  DeliveryStatus,
  PayslipDeliveryRecord,
} from "../types/payroll";

const DELIVERY_COLUMNS = `
    delivery.id AS "id",
    delivery.payslip_id AS "payslipId",
    delivery.payrun_id AS "payrunId",
    delivery.employee_id AS "employeeId",
    slip.employee_name AS "employeeName",
    delivery.recipient AS "recipient",
    delivery.status AS "status",
    delivery.attempts AS "attempts",
    delivery.error AS "error",
    delivery.queued_at AS "queuedAt",
    delivery.sent_at AS "sentAt",
    delivery.updated_at AS "updatedAt"
`;

const DELIVERY_FROM = `
  FROM payslip_deliveries delivery
  JOIN payslips slip ON slip.id = delivery.payslip_id
`;

export type QueuedDelivery = {
  payslipId: string;
  payrunId: string;
  employeeId: string;
  recipient: string;
  queuedBy?: string;
  jobId: string;
};

/**
 * Claims a payslip for sending and returns the stored row. A payslip already
 * queued or in flight is not claimed twice -- pressing send again while the
 * worker is running must not put a second copy in the employee's inbox.
 */
export async function claimDelivery(
  delivery: QueuedDelivery,
): Promise<PayslipDeliveryRecord | null> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO payslip_deliveries (
       payslip_id, payrun_id, employee_id, recipient, status, attempts,
       error, message_id, job_id, queued_by, queued_at, sent_at, updated_at
     )
     VALUES ($1, $2, $3, $4, 'queued', 0, '', '', $6, $5, NOW(), NULL, NOW())
     ON CONFLICT (payslip_id) DO UPDATE
       SET recipient = EXCLUDED.recipient,
           status = 'queued',
           attempts = 0,
           error = '',
           message_id = '',
           job_id = EXCLUDED.job_id,
           queued_by = EXCLUDED.queued_by,
           queued_at = NOW(),
           sent_at = NULL,
           updated_at = NOW()
       WHERE payslip_deliveries.status IN ('sent', 'failed')
     RETURNING id`,
    [
      delivery.payslipId,
      delivery.payrunId,
      delivery.employeeId,
      delivery.recipient,
      delivery.queuedBy ?? null,
      delivery.jobId,
    ],
  );

  if (!result.rows[0]) {
    return null;
  }

  return findDeliveryByPayslip(delivery.payslipId);
}

/** Claim this exact queued attempt; a stalled job must never send twice. */
export async function beginDelivery(payslipId: string, jobId: string, attempts: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE payslip_deliveries SET status = 'sending', attempts = $3, updated_at = NOW()
     WHERE payslip_id = $1 AND job_id = $2 AND status = 'queued' RETURNING id`,
    [payslipId, jobId, attempts],
  );
  return Boolean(result.rowCount);
}

export async function markDeliveryStatus(
  payslipId: string,
  status: DeliveryStatus,
  details: { jobId: string; attempts?: number; error?: string; messageId?: string },
): Promise<void> {
  await pool.query(
    `UPDATE payslip_deliveries
     SET status = $2, attempts = COALESCE($3, attempts), error = COALESCE($4, error),
         message_id = COALESCE($5, message_id),
         sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END, updated_at = NOW()
     WHERE payslip_id = $1 AND job_id = $6 AND status IN ('queued', 'sending')`,
    [payslipId, status, details.attempts ?? null, details.error ?? null,
      details.messageId ?? null, details.jobId],
  );
}

export async function findDeliveryAttempt(payslipId: string): Promise<{
  jobId: string; status: DeliveryStatus;
} | null> {
  const result = await pool.query(
    `SELECT job_id AS "jobId", status FROM payslip_deliveries WHERE payslip_id = $1`,
    [payslipId],
  );
  return result.rows[0] ?? null;
}

export async function findDeliveryByPayslip(
  payslipId: string,
): Promise<PayslipDeliveryRecord | null> {
  const result = await pool.query<PayslipDeliveryRecord>(
    `SELECT ${DELIVERY_COLUMNS} ${DELIVERY_FROM} WHERE delivery.payslip_id = $1`,
    [payslipId],
  );

  return result.rows[0] ?? null;
}

export async function findDeliveriesByPayrun(
  payrunId: string,
): Promise<PayslipDeliveryRecord[]> {
  const result = await pool.query<PayslipDeliveryRecord>(
    `SELECT ${DELIVERY_COLUMNS} ${DELIVERY_FROM}
     WHERE delivery.payrun_id = $1
     ORDER BY slip.employee_name ASC`,
    [payrunId],
  );

  return result.rows;
}

/** Candidates only: the caller must inspect Redis before releasing a job. */
export async function findStaleDeliveries(olderThanMinutes: number): Promise<{
  payslipId: string; jobId: string; status: DeliveryStatus;
}[]> {
  const result = await pool.query(
    `SELECT payslip_id AS "payslipId", job_id AS "jobId", status
     FROM payslip_deliveries WHERE status IN ('queued', 'sending')
       AND updated_at < NOW() - ($1 || ' minutes')::interval`,
    [String(olderThanMinutes)],
  );
  return result.rows;
}
