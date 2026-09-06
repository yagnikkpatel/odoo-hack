import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";

export const PAYSLIP_EMAIL_QUEUE = "payslip-email";

export const SEND_PAYSLIP_JOB = "send-payslip";
export const SWEEP_DELIVERIES_JOB = "expire-stale-deliveries";

const SWEEP_SCHEDULER_ID = "payslip-delivery-sweep";

/** Often enough that a stuck recipient clears within one coffee break. */
const SWEEP_CRON = "*/10 * * * *";

/**
 * A delivery still unfinished after this long is not in flight -- the retries
 * of a single job span well under it -- so the sweep releases it for re-sending.
 */
export const STALE_DELIVERY_MINUTES = 20;

export type SendPayslipEmailJob = {
  payslipId: string;
  payrunId: string;
  /** Resolved at enqueue time so a later profile edit cannot redirect the mail. */
  recipient: string;
  requestedBy?: string;
};

export type SweepDeliveriesJob = Record<string, never>;

export type PayslipEmailJobData = SendPayslipEmailJob | SweepDeliveriesJob;

export function isSendPayslipJob(
  data: PayslipEmailJobData,
): data is SendPayslipEmailJob {
  return "payslipId" in data;
}

export const payslipEmailQueue = new Queue<PayslipEmailJobData>(
  PAYSLIP_EMAIL_QUEUE,
  {
    connection: { ...bullmqConnection, maxRetriesPerRequest: 1, enableOfflineQueue: false },
    defaultJobOptions: {
      // An SMTP refusal is usually a throttle or a dropped connection, so the
      // retries are spaced widely enough for the provider to let the account
      // back in rather than hammering it.
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  },
);

payslipEmailQueue.on("error", (error) => logger.error({ err: error }, "payslip queue error"));

export async function enqueuePayslipEmail(
  job: SendPayslipEmailJob,
  jobId: string,
): Promise<string | null> {
  const queued = await payslipEmailQueue.add(SEND_PAYSLIP_JOB, job, { jobId });

  logger.info(
    {
      queue: PAYSLIP_EMAIL_QUEUE,
      jobId: queued.id,
      payslipId: job.payslipId,
      payrunId: job.payrunId,
    },
    "queued payslip email",
  );

  return queued.id ?? null;
}

export async function registerDeliverySweepSchedule(): Promise<void> {
  try {
    await payslipEmailQueue.upsertJobScheduler(
      SWEEP_SCHEDULER_ID,
      { pattern: SWEEP_CRON },
      { name: SWEEP_DELIVERIES_JOB, data: {}, opts: { attempts: 1 } },
    );

    logger.info(
      { queue: PAYSLIP_EMAIL_QUEUE, pattern: SWEEP_CRON },
      "payslip delivery sweep registered",
    );
  } catch (error) {
    logger.error({ err: error }, "failed to register payslip delivery sweep");
  }
}
