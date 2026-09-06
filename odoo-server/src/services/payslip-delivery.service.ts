import { AppError } from "../errors/AppError";
import { isSmtpConfigured } from "../config/env";
import { isValidEmail } from "../lib/mailer";
import { logger } from "../lib/logger";
import {
  claimDelivery,
  findDeliveriesByPayrun,
  findDeliveryByPayslip,
  markDeliveryStatus,
  recordDeliveryJob,
} from "../repositories/payslipDelivery.repository";
import { findPayrunById } from "../repositories/payrun.repository";
import {
  findAllPayslips,
  findPayslipById,
} from "../repositories/payslip.repository";
import { enqueuePayslipEmail } from "../queues/payslipEmail.queue";
import {
  DeliveryDispatchResult,
  DeliverySkip,
  PayslipDeliveryRecord,
  PayslipRecord,
} from "../types/payroll";

/**
 * Payroll leaves the building here, so only finalised payroll may be sent: a
 * draft or merely computed payrun is still being edited, and an employee who
 * has received a payslip cannot be sent a corrected one without explanation.
 */
const SENDABLE_PAYRUN_STATUSES = new Set(["validated", "paid"]);

function requireSmtp(): void {
  if (!isSmtpConfigured) {
    throw new AppError(
      503,
      "Email delivery is not configured. Set the SMTP variables on the server and start the payslip email worker.",
    );
  }
}

/** Resolves the address to use, or the reason this payslip cannot be sent. */
function resolveRecipient(
  slip: PayslipRecord,
  override?: string,
): { recipient: string } | { reason: string } {
  if (!slip.lines.length || slip.status === "draft") {
    return { reason: "This payslip has not been computed yet." };
  }

  const address = (override ?? slip.employeeEmail ?? "").trim();

  if (!address) {
    return { reason: "No email address on file for this employee." };
  }

  if (!isValidEmail(address)) {
    return { reason: `${address} is not a valid email address.` };
  }

  return { recipient: address };
}

async function dispatch(
  slips: PayslipRecord[],
  payrunId: string,
  overrides: Record<string, string>,
  requestedBy?: string,
): Promise<DeliveryDispatchResult> {
  const queued: PayslipDeliveryRecord[] = [];
  const skipped: DeliverySkip[] = [];

  for (const slip of slips) {
    const resolved = resolveRecipient(slip, overrides[slip.id]);

    if ("reason" in resolved) {
      skipped.push({
        payslipId: slip.id,
        employeeName: slip.employeeName,
        reason: resolved.reason,
      });

      continue;
    }

    const claimed = await claimDelivery({
      payslipId: slip.id,
      payrunId,
      employeeId: slip.employeeId,
      recipient: resolved.recipient,
      queuedBy: requestedBy,
    });

    if (!claimed) {
      skipped.push({
        payslipId: slip.id,
        employeeName: slip.employeeName,
        reason: "This payslip is already being sent.",
      });

      continue;
    }

    try {
      const jobId = await enqueuePayslipEmail({
        payslipId: slip.id,
        payrunId,
        recipient: resolved.recipient,
        requestedBy,
      });

      if (jobId) {
        await recordDeliveryJob(slip.id, jobId);
      }

      queued.push(claimed);
    } catch (error) {
      // The row was claimed before the job was accepted, so releasing it here
      // is what keeps a Redis outage from leaving a payslip stuck as 'queued'.
      await markDeliveryStatus(slip.id, "failed", {
        error: "Could not be queued for delivery. Try again.",
      });

      logger.error(
        { err: error, payslipId: slip.id },
        "payslip email could not be queued",
      );

      skipped.push({
        payslipId: slip.id,
        employeeName: slip.employeeName,
        reason: "Could not be queued for delivery. Try again.",
      });
    }
  }

  return { payrunId, queued, skipped };
}

/**
 * "Send all" for a payrun. Passing payslipIds narrows it to a subset, which is
 * how the delivery dialog sends only the recipients that are still ticked.
 */
export async function sendPayrunPayslips(
  payrunId: string,
  input: {
    payslipIds?: string[];
    recipients?: { payslipId: string; email: string }[];
  },
  requestedBy?: string,
): Promise<DeliveryDispatchResult> {
  requireSmtp();

  const payrun = await findPayrunById(payrunId);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  if (!SENDABLE_PAYRUN_STATUSES.has(payrun.status)) {
    throw new AppError(
      409,
      "Validate this payrun before sending its payslips to employees",
    );
  }

  const { rows } = await findAllPayslips({
    limit: 500,
    offset: 0,
    payrunId,
  });

  const requested = input.payslipIds?.length ? new Set(input.payslipIds) : null;
  const selected = requested
    ? rows.filter((slip) => requested.has(slip.id))
    : rows;

  if (!selected.length) {
    throw new AppError(404, "No payslips were found to send for this payrun");
  }

  const overrides: Record<string, string> = {};

  for (const entry of input.recipients ?? []) {
    overrides[entry.payslipId] = entry.email;
  }

  const result = await dispatch(selected, payrunId, overrides, requestedBy);

  logger.info(
    {
      payrunId,
      queued: result.queued.length,
      skipped: result.skipped.length,
      requestedBy,
    },
    "payslip delivery dispatched",
  );

  return result;
}

/** One payslip, optionally to an address other than the one on the record. */
export async function sendPayslip(
  payslipId: string,
  input: { email?: string },
  requestedBy?: string,
): Promise<DeliveryDispatchResult> {
  requireSmtp();

  const slip = await findPayslipById(payslipId);

  if (!slip) {
    throw new AppError(404, "Payslip not found");
  }

  const payrun = await findPayrunById(slip.payrunId);

  if (!payrun || !SENDABLE_PAYRUN_STATUSES.has(payrun.status)) {
    throw new AppError(
      409,
      "Validate this payrun before sending its payslips to employees",
    );
  }

  const overrides = input.email ? { [slip.id]: input.email } : {};
  const result = await dispatch([slip], slip.payrunId, overrides, requestedBy);

  // A single send is a direct request, so a refusal is an error the caller can
  // show rather than a silent entry in a skipped list.
  if (!result.queued.length) {
    throw new AppError(
      409,
      result.skipped[0]?.reason ?? "This payslip could not be sent.",
    );
  }

  return result;
}

export async function getPayrunDeliveries(
  payrunId: string,
): Promise<PayslipDeliveryRecord[]> {
  const payrun = await findPayrunById(payrunId);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  return findDeliveriesByPayrun(payrunId);
}

export async function getPayslipDelivery(
  payslipId: string,
): Promise<PayslipDeliveryRecord | null> {
  return findDeliveryByPayslip(payslipId);
}
