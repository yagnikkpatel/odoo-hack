import { redis } from "./redis";
import { logger } from "./logger";
import { env } from "../config/env";

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);

    if (!cached) {
      logger.info({ cache: "MISS", key }, "cache miss");

      return null;
    }

    logger.info({ cache: "HIT", key }, "cache hit");

    return JSON.parse(cached) as T;
  } catch (error) {
    logger.warn({ err: error, key }, "cache read failed, falling back to database");

    return null;
  }
}

export async function setCached(key: string, value: unknown): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", env.cacheTtlSeconds);

    logger.info(
      { cache: "SET", key, ttlSeconds: env.cacheTtlSeconds },
      "cache populated",
    );
  } catch (error) {
    logger.warn({ err: error, key }, "cache write failed");
  }
}

export async function invalidateCache(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  try {
    const removed = await redis.del(...keys);

    logger.info({ cache: "INVALIDATE", keys, removed }, "cache invalidated");
  } catch (error) {
    logger.warn({ err: error, keys }, "cache invalidation failed");
  }
}
