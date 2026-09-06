import { Job, UnrecoverableError } from "bullmq";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { sendMail } from "../lib/mailer";
import { PasswordResetOtpJob } from "../queues/authEmail.queue";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatValidity(seconds: number): string {
  if (seconds < 120) return `${seconds} seconds`;

  const minutes = Math.round(seconds / 60);

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function buildPasswordResetMessage(job: PasswordResetOtpJob): {
  subject: string;
  text: string;
  html: string;
} {
  const validity = formatValidity(job.expiresInSeconds);

  const text = [
    `Hello ${job.name},`,
    "",
    "Use this code to reset your password:",
    "",
    job.otp,
    "",
    `The code expires in ${validity} and can be used once.`,
    "If you did not ask to reset your password, ignore this email -- your current password still works.",
    "",
    env.smtpFromName,
  ].join("\n");

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#22252e">
  <p>Hello ${escapeHtml(job.name)},</p>
  <p>Use this code to reset your password:</p>
  <p style="font-family:'SFMono-Regular',Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0;color:#22252e">${escapeHtml(job.otp)}</p>
  <p>The code expires in <strong>${escapeHtml(validity)}</strong> and can be used once.</p>
  <p style="color:#6b6f77;font-size:12px">If you did not ask to reset your password, ignore this email &mdash; your current password still works.</p>
  <p style="color:#6b6f77;font-size:12px">${escapeHtml(env.smtpFromName)}</p>
</div>`;

  return {
    subject: `${job.otp} is your password reset code`,
    text,
    html,
  };
}

export async function processAuthEmail(
  job: Job<PasswordResetOtpJob>,
): Promise<object> {
  try {
    const messageId = await sendMail({
      to: job.data.to,
      ...buildPasswordResetMessage(job.data),
    });

    logger.info(
      { jobId: job.id, email: job.data.to, messageId },
      "password reset otp email sent",
    );

    return { messageId };
  } catch (cause) {
    const error = cause as Error & { code?: string; responseCode?: number };
    // Bad credentials or a hard rejection will fail the same way on every
    // retry, and the OTP expires long before an operator can fix the account.
    const permanent =
      error.code === "EAUTH" || (error.responseCode ?? 0) >= 500;

    if (permanent) {
      throw new UnrecoverableError(error.message.slice(0, 500));
    }

    throw error;
  }
}
