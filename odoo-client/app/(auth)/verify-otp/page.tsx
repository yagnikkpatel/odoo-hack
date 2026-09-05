import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { VerifyOtpView } from "@/features/auth/components/verify-otp-view";
import { parseEmail } from "@/features/auth/auth-validation";

export const metadata: Metadata = {
  title: "Enter your recovery code",
  robots: "noindex,nofollow",
  alternates: {
    canonical: "/verify-otp",
  },
};

type PageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function VerifyOtpPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  // Without an address there is nothing to verify against; send them back a step.
  const address = parseEmail(typeof email === "string" ? email : null);
  if (!address) redirect("/forgot-password");

  return <VerifyOtpView email={address} />;
}
