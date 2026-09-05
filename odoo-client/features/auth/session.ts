import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/features/auth/auth-constants";
import { getBackendApiEndpoint } from "@/lib/backend-api";

type SessionUser = {
  userId: string;
  email: string;
  role: string;
};

type CurrentUserResponse = {
  success: true;
  data: {
    user: SessionUser;
  };
};

export const verifySession = cache(async (): Promise<SessionUser> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const response = await fetch(getBackendApiEndpoint("/auth/me"), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/login");
  }

  const payload = (await response.json()) as CurrentUserResponse;

  if (!payload.data?.user) {
    redirect("/login");
  }

  return payload.data.user;
});
