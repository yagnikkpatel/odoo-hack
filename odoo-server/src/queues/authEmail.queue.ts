import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";

export const AUTH_EMAIL_QUEUE = "auth-email";

export const PASSWORD_RESET_OTP_JOB = "password-reset-otp";

export type PasswordResetOtpJob = {
  /** Resolved at enqueue time so a later profile edit cannot redirect the mail. */
  to: string;
  name: string;
  otp: string;
  expiresInSeconds: number;
};

export const authEmailQueue = new Queue<PasswordResetOtpJob>(AUTH_EMAIL_QUEUE, {
  // Fail fast instead of buffering: a caller waiting on a reset email needs to
  // be told that the code is not coming, not to have the request accepted into
  // an offline Redis.
  connection: { ...bullmqConnection, maxRetriesPerRequest: 1, enableOfflineQueue: false },
  defaultJobOptions: {
    // Retries stay inside the OTP's own lifetime -- delivering a code that has
    // already expired only sends the user back to the start of the flow.
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    // The payload carries a live OTP, so a completed job is dropped immediately
    // and a failed one is kept only long enough to outlive the code it holds.
    removeOnComplete: true,
    removeOnFail: { age: 900, count: 200 },
  },
});

authEmailQueue.on("error", (error) => logger.error({ err: error }, "auth email queue error"));

export async function enqueuePasswordResetOtpEmail(
  job: PasswordResetOtpJob,
): Promise<string | null> {
  const queued = await authEmailQueue.add(PASSWORD_RESET_OTP_JOB, job);

  logger.info(
    { queue: AUTH_EMAIL_QUEUE, jobId: queued.id, email: job.to },
    "queued password reset otp email",
  );

  return queued.id ?? null;
}
