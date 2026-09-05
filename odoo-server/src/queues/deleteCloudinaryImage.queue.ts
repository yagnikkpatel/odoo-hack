import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";

const QUEUE_NAME = "cloudinary-jobs";
const DELETE_CLOUDINARY_IMAGE_JOB = "delete-cloudinary-image";

type DeleteCloudinaryImageJobData = {
  publicId: string;
};

export const deleteCloudinaryImageQueue = new Queue(QUEUE_NAME, {
  connection: bullmqConnection,
});

export async function addDeleteCloudinaryImageJob(
  publicId: string,
): Promise<void> {
  const jobData: DeleteCloudinaryImageJobData = {
    publicId,
  };

  // add one job to our queue

  await deleteCloudinaryImageQueue.add(DELETE_CLOUDINARY_IMAGE_JOB, jobData, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
}
