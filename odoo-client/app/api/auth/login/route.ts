import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/features/auth/auth-constants";
import { getBackendApiEndpoint } from "@/lib/backend-api";

type BackendLoginResponse = {
  success?: boolean;
  message?: string;
  data?: {
    accessToken?: string;
  };
};

type LoginRequest = {
  email: string;
  password: string;
  rememberMe: boolean;
};

function parseLoginRequest(value: unknown): LoginRequest | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const rememberMe = input.rememberMe;

  if (
    !email ||
    !email.includes("@") ||
    !password ||
    typeof rememberMe !== "boolean"
  ) {
    return null;
  }

  return { email, password, rememberMe };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = parseLoginRequest(body);

  if (!input) {
    return NextResponse.json(
      { success: false, message: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  try {
    const backendResponse = await fetch(getBackendApiEndpoint("/auth/login"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
      cache: "no-store",
    });

    const payload = (await backendResponse.json().catch(() => null)) as
      | BackendLoginResponse
      | null;

    if (!backendResponse.ok || !payload?.data?.accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: payload?.message ?? "Unable to sign in with those credentials.",
        },
        { status: backendResponse.status || 502 },
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: payload.data.accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(input.rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "The authentication service is currently unavailable.",
      },
      { status: 503 },
    );
  }
}
