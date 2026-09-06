import { Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { pool } from "../lib/db";
import { env } from "../config/env";
import { closeMailer, sendMail, verifyMailer } from "../lib/mailer";
import { generatePayslipPdf, payslipFilename } from "../lib/payslip-pdf";
import { findPayslipById } from "../repositories/payslip.repository";
import {
  expireStaleDeliveries,
  markDeliveryStatus,
} from "../repositories/payslipDelivery.repository";
import {
  PAYSLIP_EMAIL_QUEUE,
  PayslipEmailJobData,
  STALE_DELIVERY_MINUTES,
  isSendPayslipJob,
  registerDeliverySweepSchedule,
} from "../queues/payslipEmail.queue";
import { PayslipRecord } from "../types/payroll";

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

const worker = new Worker<PayslipEmailJobData>(
  PAYSLIP_EMAIL_QUEUE,
  async (job) => {
    if (!isSendPayslipJob(job.data)) {
      const released = await expireStaleDeliveries(STALE_DELIVERY_MINUTES);

      if (released > 0) {
        logger.warn({ released }, "released stale payslip deliveries");
      }

      return { released };
    }

    const { payslipId, payrunId, recipient } = job.data;

    await markDeliveryStatus(payslipId, "sending", {
      attempts: job.attemptsMade + 1,
    });

    const slip = await findPayslipById(payslipId);

    if (!slip) {
      // The payslip was deleted between queueing and delivery. Retrying cannot
      // help, so the delivery is closed rather than left to burn its attempts.
      await markDeliveryStatus(payslipId, "failed", {
        error: "This payslip no longer exists.",
      });

      return { payslipId, skipped: "payslip-deleted" };
    }

    const pdf = await generatePayslipPdf(slip);
    const message = buildMessage(slip);

    const messageId = await sendMail({
      to: recipient,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: [
        {
          filename: payslipFilename(slip),
          content: Buffer.from(pdf),
          contentType: "application/pdf",
        },
      ],
    });

    await markDeliveryStatus(payslipId, "sent", {
      attempts: job.attemptsMade + 1,
      error: "",
      messageId,
    });

    logger.info(
      { jobId: job.id, payslipId, payrunId, recipient, messageId },
      "payslip emailed",
    );

    return { payslipId, recipient, messageId };
  },
  {
    connection: bullmqConnection,
    // Matched to the SMTP pool: more workers than connections would only queue
    // inside nodemailer and hold database rows in 'sending' while they waited.
    concurrency: env.smtpMaxConnections,
  },
);

worker.on("failed", async (job, error) => {
  if (!job || !isSendPayslipJob(job.data)) {
    logger.error({ err: error, jobId: job?.id }, "payslip delivery sweep failed");

    return;
  }

  const attempts = job.attemptsMade;
  const exhausted = attempts >= (job.opts.attempts ?? 1);

  logger.error(
    {
      err: error,
      jobId: job.id,
      payslipId: job.data.payslipId,
      attempts,
      exhausted,
    },
    "payslip email failed",
  );

  // Only the last failure is final. Earlier ones stay in flight so the screen
  // keeps showing the recipient as sending while BullMQ retries it.
  if (!exhausted) {
    return;
  }

  try {
    await markDeliveryStatus(job.data.payslipId, "failed", {
      attempts,
      error: error.message.slice(0, 500),
    });
  } catch (updateError) {
    logger.error(
      { err: updateError, payslipId: job.data.payslipId },
      "could not record payslip delivery failure",
    );
  }
});

worker.on("ready", () => {
  logger.info({ queue: PAYSLIP_EMAIL_QUEUE }, "payslip email worker ready");
});

void verifyMailer();
void registerDeliverySweepSchedule();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down payslip email worker");

  await worker.close();
  await closeMailer();
  await pool.end();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
