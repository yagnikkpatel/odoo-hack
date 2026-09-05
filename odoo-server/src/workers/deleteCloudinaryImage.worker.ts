import { Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { deleteImageFromCloudinary } from "../lib/cloudinary";
import { logger } from "../lib/logger";
import {
  CLOUDINARY_DELETE_QUEUE,
  DeleteCloudinaryImageJob,
} from "../queues/deleteCloudinaryImage.queue";

const worker = new Worker<DeleteCloudinaryImageJob>(
  CLOUDINARY_DELETE_QUEUE,
  async (job) => {
    const outcome = await deleteImageFromCloudinary(job.data.publicId);

    logger.info(
      {
        jobId: job.id,
        publicId: job.data.publicId,
        reason: job.data.reason,
        outcome,
      },
      "cloudinary image deleted",
    );

    return outcome;
  },
  {
    connection: bullmqConnection,
    concurrency: 5,
  },
);

worker.on("failed", (job, error) => {
  logger.error(
    { err: error, jobId: job?.id, publicId: job?.data.publicId },
    "cloudinary image deletion failed",
  );
});

worker.on("ready", () => {
  logger.info(
    { queue: CLOUDINARY_DELETE_QUEUE },
    "cloudinary delete worker ready",
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down cloudinary delete worker");

  await worker.close();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
