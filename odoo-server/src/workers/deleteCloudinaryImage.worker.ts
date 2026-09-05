import { Worker } from "bullmq";
import { deleteBannerImageFromCloudinary } from "../lib/cloudinary";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";

const QUEUE_NAME = "cloudinary-jobs";
const DELETE_CLOUDINARY_IMAGE_JOB = "delete-cloudinary-image";

type DeleteCloudinaryImageJobData = {
  publicId: string;
};

export const deleteCloudinaryImageWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name !== DELETE_CLOUDINARY_IMAGE_JOB) {
      return;
    }

    const data = job.data as DeleteCloudinaryImageJobData;

    await deleteBannerImageFromCloudinary(data.publicId);
  },
  {
    connection: bullmqConnection,
  },
);

deleteCloudinaryImageWorker.on("completed", (job) => {
  logger.info(`Cloudinary delete job completed: ${job.id}`);
});

deleteCloudinaryImageWorker.on("failed", (job, error) => {
  logger.error(
    {
      err: error,
      jobId: job?.id,
    },
    "Cloudinary delete job failed",
  );
});

logger.info("Delete Cloudinary image worker started");
