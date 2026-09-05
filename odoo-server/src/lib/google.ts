import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export type GoogleUserProfile = {
  googleId: string;
  email: string;
};

const googleOauthClient = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret,
  env.googleRedirectUrl,
);

export function getGoogleAuthUrl(): string {
  return googleOauthClient.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    access_type: "online",
    prompt: "select_account",
  });
}

export async function getGoogleUserFromAuthCode(
  code: string,
): Promise<GoogleUserProfile> {
  if (!code) {
    throw new AppError(400, "Google auth code is required");
  }

  const { tokens } = await googleOauthClient.getToken(code);

  if (!tokens.id_token) {
    throw new AppError(401, "Google login failed: id_token missing");
  }

  // user info received from google
  const ticketInfo = await googleOauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.googleClientId,
  });

  const payload = ticketInfo.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new AppError(401, "Google login failed: invalid user profile");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
  };
}
