import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { ATTENDANCE_TIMEZONE } from "../types/attendance";

export const MARK_ABSENTEES_QUEUE = "attendance-mark-absentees";

const MARK_ABSENTEES_SCHEDULER_ID = "attendance-daily-absentees";

/** 00:15 company time, so the previous day is fully closed before it is judged. */
const MARK_ABSENTEES_CRON = "15 0 * * *";

export type MarkAbsenteesJob = {
  /** YYYY-MM-DD to backfill. Omitted on scheduled runs, which use yesterday. */
  attendanceDate?: string;
};

export const markAbsenteesQueue = new Queue<MarkAbsenteesJob>(
  MARK_ABSENTEES_QUEUE,
  {
    connection: bullmqConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
);

export async function registerMarkAbsenteesSchedule(): Promise<void> {
  try {
    await markAbsenteesQueue.upsertJobScheduler(
      MARK_ABSENTEES_SCHEDULER_ID,
      { pattern: MARK_ABSENTEES_CRON, tz: ATTENDANCE_TIMEZONE },
      { name: "mark-absentees", data: {} },
    );

    logger.info(
      {
        queue: MARK_ABSENTEES_QUEUE,
        pattern: MARK_ABSENTEES_CRON,
        tz: ATTENDANCE_TIMEZONE,
      },
      "absentee schedule registered",
    );
  } catch (error) {
    logger.error({ err: error }, "failed to register absentee schedule");
  }
}

export async function enqueueMarkAbsentees(
  attendanceDate?: string,
): Promise<void> {
  try {
    const job = await markAbsenteesQueue.add("mark-absentees", {
      attendanceDate,
    });

    logger.info(
      { queue: MARK_ABSENTEES_QUEUE, jobId: job.id, attendanceDate },
      "queued absentee marking",
    );
  } catch (error) {
    logger.error({ err: error, attendanceDate }, "failed to queue absentee marking");
  }
}
