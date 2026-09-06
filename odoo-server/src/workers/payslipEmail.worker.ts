import { Worker } from "bullmq";
import { bullmqConnection, redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { pool } from "../lib/db";
import { env } from "../config/env";
import { closeMailer, verifyMailer } from "../lib/mailer";
import { clearEmailWorkerReady, publishEmailWorkerReady } from "../lib/payroll-email-readiness";
import { PAYSLIP_EMAIL_QUEUE, PayslipEmailJobData, payslipEmailQueue, registerDeliverySweepSchedule } from "../queues/payslipEmail.queue";
import { processPayslipEmail, reconcileDeliveries } from "../services/payslip-email-job.service";

let worker: Worker<PayslipEmailJobData> | undefined;
let heartbeat: NodeJS.Timeout | undefined;
let stopping = false;

async function shutdown(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  await clearEmailWorkerReady().catch(() => undefined);
  await worker?.close();
  await closeMailer();
  await payslipEmailQueue.close();
  await pool.end();
  redis.disconnect();
  process.exit(code);
}

async function start(): Promise<void> {
  // Verify before constructing a consumer: a bad SMTP configuration must not
  // consume the retry budget of every email already waiting in Redis.
  if (!await verifyMailer()) throw new Error("Email worker startup failed: check the SMTP configuration.");
  await payslipEmailQueue.waitUntilReady();
  await reconcileDeliveries();
  worker = new Worker<PayslipEmailJobData>(PAYSLIP_EMAIL_QUEUE, processPayslipEmail, {
    connection: bullmqConnection, concurrency: env.smtpMaxConnections, autorun: false,
  });
  worker.on("error", (error) => {
    logger.error({ err: error }, "email worker connection error");
    void clearEmailWorkerReady().catch(() => undefined);
  });
  worker.on("failed", (job, error) => logger.error({ err: error, jobId: job?.id }, "payslip email job failed"));
  worker.on("completed", (job) => logger.info({ jobId: job.id }, "payslip email job completed"));
  await worker.waitUntilReady();
  void worker.run().catch(async (error) => {
    logger.error({ err: error }, "email worker stopped");
    await shutdown(1);
  });
  const announce = async () => {
    if (!stopping && worker?.isRunning() && !worker.isPaused()) await publishEmailWorkerReady();
  };
  await announce();
  heartbeat = setInterval(() => void announce().catch((error) => {
    logger.error({ err: error }, "email worker readiness update failed");
  }), 5_000);
  await registerDeliverySweepSchedule();
  logger.info({ queue: PAYSLIP_EMAIL_QUEUE }, "payslip email worker ready");
}
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
void start().catch(async (error) => {
  logger.error({ err: error }, "payslip email worker startup failed");
  await shutdown(1);
});
