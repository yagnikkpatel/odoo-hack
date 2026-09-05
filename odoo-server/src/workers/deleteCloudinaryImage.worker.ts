import { Worker } from "bullmq";
import { deleteImageFromCloudinary } from "../lib/cloudinary";
import { logger } from "../lib/logger";
import { bullmqConnection } from "../lib/redis";
import { CLOUDINARY_QUEUE, DELETE_IMAGE_JOB } from "../queues/deleteCloudinaryImage.queue";

export const deleteCloudinaryImageWorker = new Worker<{ publicId: string }>(
  CLOUDINARY_QUEUE,
  async (job) => {
    if (job.name !== DELETE_IMAGE_JOB) {
      return;
    }

    await deleteImageFromCloudinary(job.data.publicId);

    logger.info({ publicId: job.data.publicId }, "cloudinary asset deleted");
  },
  { connection: bullmqConnection },
);

deleteCloudinaryImageWorker.on("failed", (job, error) => {
  logger.error({ err: error, jobId: job?.id }, "cloudinary deletion failed");
});
