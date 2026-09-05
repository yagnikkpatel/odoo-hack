import { Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { pool } from "../lib/db";
import {
  MARK_ABSENTEES_QUEUE,
  MarkAbsenteesJob,
  registerMarkAbsenteesSchedule,
} from "../queues/markAbsentees.queue";
import { markAbsentees } from "../services/attendance.service";
import { ATTENDANCE_TIMEZONE } from "../types/attendance";

async function resolveYesterday(): Promise<string> {
  const result = await pool.query<{ day: string }>(
    `SELECT to_char((NOW() AT TIME ZONE $1::text)::date - 1, 'YYYY-MM-DD') AS "day"`,
    [ATTENDANCE_TIMEZONE],
  );

  return result.rows[0].day;
}

const worker = new Worker<MarkAbsenteesJob>(
  MARK_ABSENTEES_QUEUE,
  async (job) => {
    const attendanceDate = job.data.attendanceDate ?? (await resolveYesterday());
    const marked = await markAbsentees(attendanceDate);

    logger.info(
      { jobId: job.id, attendanceDate, marked },
      "absentees marked",
    );

    return { attendanceDate, marked };
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

worker.on("failed", (job, error) => {
  logger.error(
    { err: error, jobId: job?.id, attendanceDate: job?.data.attendanceDate },
    "absentee marking failed",
  );
});

worker.on("ready", () => {
  logger.info({ queue: MARK_ABSENTEES_QUEUE }, "absentee worker ready");
});

void registerMarkAbsenteesSchedule();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down absentee worker");

  await worker.close();
  await pool.end();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
