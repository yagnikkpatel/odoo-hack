import type { Metadata } from "next";

import { LoginView } from "@/features/auth/components/login-view";
import {
  AuthServiceUnavailableError,
  getSession,
} from "@/features/auth/session";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Sign in",
  robots: "noindex,nofollow",
  alternates: {
    canonical: "/login",
  },
};

export default async function LoginPage() {
  let user;
  try {
    user = await getSession();
  } catch (error) {
    // Keep sign-in usable during an outage; submitting surfaces the API error.
    if (!(error instanceof AuthServiceUnavailableError)) throw error;
  }
  if (user) redirect(siteConfig.authenticatedHome);
  return <LoginView />;
}
