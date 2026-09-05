import { randomUUID } from "node:crypto";
import { signRefreshToken } from "../lib/jwt";
import { redis } from "../lib/redis";
import { TokenPayload } from "../types/user";

// Refresh tokens are whitelisted in Redis so a session can be revoked on
// logout and so a rotated (already used) token stops working immediately.
function sessionKey(userId: string, sessionId: string): string {
  return `auth:refresh:${userId}:${sessionId}`;
}

export async function issueRefreshToken(
  payload: TokenPayload,
  sessionId: string = randomUUID(),
): Promise<{ refreshToken: string; expiresInSeconds: number }> {
  const { token, expiresInSeconds } = signRefreshToken({
    ...payload,
    sessionId,
    type: "refresh",
  });

  await redis.set(
    sessionKey(payload.userId, sessionId),
    "1",
    "EX",
    Math.max(1, expiresInSeconds),
  );

  return { refreshToken: token, expiresInSeconds };
}

export async function isRefreshSessionActive(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  return (await redis.exists(sessionKey(userId, sessionId))) === 1;
}

export async function revokeRefreshSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  await redis.del(sessionKey(userId, sessionId));
}

export async function revokeAllRefreshSessions(userId: string): Promise<void> {
  const pattern = sessionKey(userId, "*");
  let cursor = "0";

  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = next;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}
