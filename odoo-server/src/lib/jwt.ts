import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { RefreshTokenPayload, TokenPayload } from "../types/user";
import jwt, { SignOptions } from "jsonwebtoken";

export type SignedToken = {
  token: string;
  expiresInSeconds: number;
};

function expiresInSeconds(token: string): number {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new AppError(500, "Signed token is missing an expiry claim");
  }

  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}

export function signAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as TokenPayload & {
      type?: string;
    };

    // A refresh token must never authenticate a request.
    if (payload.type === "refresh") {
      throw new Error("refresh token used as access token");
    }

    return payload;
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
}

export function signRefreshToken(payload: RefreshTokenPayload): SignedToken {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
  };

  const token = jwt.sign(payload, env.jwtRefreshSecret, options);

  return { token, expiresInSeconds: expiresInSeconds(token) };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      env.jwtRefreshSecret,
    ) as RefreshTokenPayload;

    if (payload.type !== "refresh" || !payload.sessionId) {
      throw new Error("not a refresh token");
    }

    return payload;
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }
}
