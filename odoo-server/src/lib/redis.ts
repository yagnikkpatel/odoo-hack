import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl);

const redisUrl = new URL(env.redisUrl);

export const bullmqConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  maxRetriesPerRequest: null,
};
