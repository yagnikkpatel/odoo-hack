import { Worker } from "bullmq";
import { bullmqConnection, redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { closeMailer, verifyMailer } from "../lib/mailer";
import { AUTH_EMAIL_QUEUE, PasswordResetOtpJob, authEmailQueue } from "../queues/authEmail.queue";
import { processAuthEmail } from "../services/auth-email-job.service";

let worker: Worker<PasswordResetOtpJob> | undefined;
let stopping = false;

async function shutdown(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;

  await worker?.close();
  await closeMailer();
  await authEmailQueue.close();
  redis.disconnect();

  process.exit(code);
}

async function start(): Promise<void> {
  // Verify before constructing a consumer: a bad SMTP configuration must not
  // consume the retry budget of codes that are already waiting in Redis.
  if (!(await verifyMailer())) {
    throw new Error("Auth email worker startup failed: check the SMTP configuration.");
  }

  await authEmailQueue.waitUntilReady();

  worker = new Worker<PasswordResetOtpJob>(AUTH_EMAIL_QUEUE, processAuthEmail, {
    connection: bullmqConnection,
    // Reset codes are short-lived, so they are sent as fast as the transport
    // pool allows rather than trickled out one at a time.
    concurrency: 5,
  });

  worker.on("error", (error) => logger.error({ err: error }, "auth email worker connection error"));
  worker.on("failed", (job, error) =>
    logger.error({ err: error, jobId: job?.id }, "password reset otp email failed"),
  );

  await worker.waitUntilReady();

  logger.info({ queue: AUTH_EMAIL_QUEUE }, "auth email worker ready");
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

void start().catch(async (error) => {
  logger.error({ err: error }, "auth email worker startup failed");
  await shutdown(1);
});
