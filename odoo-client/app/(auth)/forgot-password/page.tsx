import type { Metadata } from "next";

import { ForgotPasswordView } from "@/features/auth/components/forgot-password-view";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: "noindex,nofollow",
  alternates: {
    canonical: "/forgot-password",
  },
};

type PageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const initialEmail = typeof email === "string" ? email : "";

  return <ForgotPasswordView initialEmail={initialEmail} />;
}
