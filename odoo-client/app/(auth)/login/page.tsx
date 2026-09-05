import type { Metadata } from "next";

import { LoginView } from "@/features/auth/components/login-view";

export const metadata: Metadata = {
  title: "Sign in",
  robots: "noindex,nofollow",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginView />;
}
