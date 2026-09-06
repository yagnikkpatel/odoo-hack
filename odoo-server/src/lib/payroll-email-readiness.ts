import { createHash, randomUUID } from "node:crypto";
import { env, isSmtpConfigured } from "../config/env";
import { redis } from "./redis";

// Scope readiness to this SMTP configuration without exposing credentials.
const configuration = createHash("sha256").update(JSON.stringify([
  env.smtpHost, env.smtpPort, env.smtpSecure, env.smtpUser, env.smtpPassword, env.smtpFromEmail,
])).digest("hex").slice(0, 24);
const prefix = `payroll-email:ready:${configuration}:`;
export const emailWorkerKey = `${prefix}${randomUUID()}`;

export async function publishEmailWorkerReady(): Promise<void> {
  await redis.set(emailWorkerKey, "1", "EX", 20);
}
export async function clearEmailWorkerReady(): Promise<void> {
  await redis.del(emailWorkerKey);
}
export async function getEmailReadiness(): Promise<{ available: boolean; reason: string }> {
  if (!isSmtpConfigured) return { available: false, reason: "Email delivery is not configured." };
  try {
    if (await redis.hexists("bull:payslip-email:meta", "paused")) {
      return { available: false, reason: "Email delivery is paused. Resume the email queue before sending." };
    }
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = next;
      if (keys.length && (await redis.mget(...keys)).some(Boolean)) {
        return { available: true, reason: "Email delivery is ready." };
      }
    } while (cursor !== "0");
    return { available: false, reason: "Email delivery is temporarily unavailable. The email worker is offline or starting." };
  } catch {
    return { available: false, reason: "Email delivery cannot connect to its queue. Please try again shortly." };
  }
}
