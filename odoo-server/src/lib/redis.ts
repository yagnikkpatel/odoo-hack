import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl);

// Match the normal Redis client's URL semantics, including auth, TLS and DB.
// Workers need unlimited retries; queue producers use a separate fail-fast connection.
const options = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
export const bullmqConnection = { ...options.options, maxRetriesPerRequest: null };
options.disconnect();
