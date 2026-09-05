import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";

export const CLOUDINARY_DELETE_QUEUE = "cloudinary-image-delete";

export type DeleteCloudinaryImageJob = {
  publicId: string;
  reason: string;
};

export const deleteCloudinaryImageQueue = new Queue<DeleteCloudinaryImageJob>(
  CLOUDINARY_DELETE_QUEUE,
  {
    connection: bullmqConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
);

export async function enqueueCloudinaryImageDeletion(
  publicId: string | null | undefined,
  reason: string,
): Promise<void> {
  if (!publicId) {
    return;
  }

  try {
    const job = await deleteCloudinaryImageQueue.add("delete-image", {
      publicId,
      reason,
    });

    logger.info(
      { queue: CLOUDINARY_DELETE_QUEUE, jobId: job.id, publicId, reason },
      "queued cloudinary image deletion",
    );
  } catch (error) {
    logger.error(
      { err: error, publicId, reason },
      "failed to queue cloudinary image deletion",
    );
  }
}
