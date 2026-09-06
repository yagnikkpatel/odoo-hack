import { Job, UnrecoverableError } from "bullmq";
import { env } from "../config/env";
import { sendMail } from "../lib/mailer";
import { generatePayslipPdf, payslipFilename } from "../lib/payslip-pdf";
import { findPayslipById } from "../repositories/payslip.repository";
import { beginDelivery, findDeliveryAttempt, findStaleDeliveries, markDeliveryStatus } from "../repositories/payslipDelivery.repository";
import { isSendPayslipJob, payslipEmailQueue, PayslipEmailJobData, STALE_DELIVERY_MINUTES } from "../queues/payslipEmail.queue";
import { PayslipRecord } from "../types/payroll";

export const UNKNOWN_DELIVERY = "Delivery outcome is unknown. Check the recipient's inbox before explicitly resending.";

const money = (value: number, currency: string): string =>
  `${currency} ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildMessage(slip: PayslipRecord): {
  subject: string;
  text: string;
  html: string;
} {
  const period = `${slip.startDate} to ${slip.endDate}`;
  const net = money(slip.net, slip.currency);

  const text = [
    `Hello ${slip.employeeName},`,
    "",
    `Your payslip for ${period} is attached.`,
    "",
    `Payrun: ${slip.payrunName}`,
    `Net salary: ${net}`,
    "",
    "This message was sent automatically. Contact HR if anything looks wrong.",
    "",
    env.smtpFromName,
  ].join("\n");

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#22252e">
  <p>Hello ${escapeHtml(slip.employeeName)},</p>
  <p>Your payslip for <strong>${escapeHtml(period)}</strong> is attached.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 24px 4px 0;color:#6b6f77">Payrun</td><td style="padding:4px 0">${escapeHtml(slip.payrunName)}</td></tr>
    <tr><td style="padding:4px 24px 4px 0;color:#6b6f77">Period</td><td style="padding:4px 0">${escapeHtml(period)}</td></tr>
    <tr><td style="padding:4px 24px 4px 0;color:#6b6f77">Net salary</td><td style="padding:4px 0"><strong>${escapeHtml(net)}</strong></td></tr>
  </table>
  <p style="color:#6b6f77;font-size:12px">This message was sent automatically. Contact HR if anything looks wrong.</p>
  <p style="color:#6b6f77;font-size:12px">${escapeHtml(env.smtpFromName)}</p>
</div>`;

  return {
    subject: `Your payslip: ${period}`,
    text,
    html,
  };
}

/** Age alone cannot distinguish an abandoned attempt from a healthy backlog. */
export async function reconcileDeliveries(): Promise<number> {
  let released = 0;
  for (const delivery of await findStaleDeliveries(STALE_DELIVERY_MINUTES)) {
    const job = delivery.jobId ? await payslipEmailQueue.getJob(delivery.jobId) : null;
    const state = job ? await job.getState() : "unknown";
    if (!["unknown", "failed", "completed"].includes(state)) continue;
    await markDeliveryStatus(delivery.payslipId, "failed", {
      jobId: delivery.jobId,
      error: delivery.status === "sending" ? UNKNOWN_DELIVERY : "Delivery job is no longer available. Send this payslip again.",
    });
    released++;
  }
  return released;
}

export async function processPayslipEmail(job: Job<PayslipEmailJobData>): Promise<object> {
  if (!isSendPayslipJob(job.data)) return { released: await reconcileDeliveries() };
  const { payslipId, recipient } = job.data;
  const jobId = job.id!;
  const attempts = job.attemptsMade + 1;
  if (!await beginDelivery(payslipId, jobId, attempts)) {
    const current = await findDeliveryAttempt(payslipId);
    if (current?.jobId === jobId && current.status === "sending") {
      // The previous worker stopped during SMTP. Automatic delivery now could
      // duplicate an email that was already accepted by the provider.
      await markDeliveryStatus(payslipId, "failed", { jobId, error: UNKNOWN_DELIVERY });
    }
    return { skipped: "attempt-already-processed-or-replaced" };
  }

  let smtpStarted = false;
  let smtpAccepted = false;
  try {
    const slip = await findPayslipById(payslipId);
    if (!slip) throw new UnrecoverableError("This payslip no longer exists.");
    if (!["validated", "paid"].includes(slip.status)) {
      throw new UnrecoverableError("This payslip is no longer finalized.");
    }
    const pdf = await generatePayslipPdf(slip);
    smtpStarted = true;
    const messageId = await sendMail({
      to: recipient, ...buildMessage(slip),
      attachments: [{ filename: payslipFilename(slip), content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    smtpAccepted = true;
    await markDeliveryStatus(payslipId, "sent", { jobId, attempts, error: "", messageId });
    return { payslipId, messageId };
  } catch (cause) {
    const error = cause as Error & { code?: string; command?: string; responseCode?: number };
    const explicitRejection = Boolean(error.responseCode && error.responseCode >= 400);
    // Nodemailer can report a socket close after DATA as command=CONN.
    // Only retry errors that prove the message was not accepted.
    const beforeDelivery = ["ECONNREFUSED", "EDNS", "ENOTFOUND", "EAI_AGAIN", "EAUTH"].includes(error.code ?? "") ||
      ["AUTH PLAIN", "AUTH LOGIN", "MAIL FROM", "RCPT TO"].includes(error.command ?? "");
    const unknown = smtpAccepted || (smtpStarted && !explicitRejection && !beforeDelivery);
    const permanent = cause instanceof UnrecoverableError || error.code === "EAUTH" || (error.responseCode ?? 0) >= 500;
    const exhausted = attempts >= (job.opts.attempts ?? 1);
    const retry = !unknown && !permanent && !exhausted;
    const message = unknown ? UNKNOWN_DELIVERY : error.message.slice(0, 500);
    await markDeliveryStatus(payslipId, retry ? "queued" : "failed", { jobId, attempts, error: message });
    if (!retry) throw new UnrecoverableError(message);
    throw error;
  }
}
