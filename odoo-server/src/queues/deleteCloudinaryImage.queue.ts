import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis";
import { logger } from "../lib/logger";

export const CLOUDINARY_QUEUE = "cloudinary-jobs";
export const DELETE_IMAGE_JOB = "delete-cloudinary-image";

let queue: Queue | null = null;

/**
 * Created on first use, not at import. A `new Queue(...)` at module scope opens a Redis
 * connection as soon as anything imports the route tree — which keeps the process alive and
 * hangs any test run or short-lived script.
 */
function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(CLOUDINARY_QUEUE, { connection: bullmqConnection });
  }

  return queue;
}

/**
 * Cleaning up a replaced asset must never fail the request that replaced it — the database is
 * already correct, and an orphaned Cloudinary file is a cost problem, not a data problem.
 */
export async function enqueueImageDeletion(publicId: string): Promise<void> {
  try {
    await getQueue().add(
      DELETE_IMAGE_JOB,
      { publicId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  } catch (error) {
    logger.warn({ err: error, publicId }, "could not enqueue cloudinary deletion");
  }
}

export async function closeQueues(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
