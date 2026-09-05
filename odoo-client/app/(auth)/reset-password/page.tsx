import type { Metadata } from "next";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PASSWORD_RESET_COOKIE_NAME } from "@/features/auth/auth-constants";
import { ResetPasswordView } from "@/features/auth/components/reset-password-view";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: "noindex,nofollow",
  alternates: {
    canonical: "/reset-password",
  },
};

export default async function ResetPasswordPage() {
  // The reset token is issued by /verify-otp. Reaching this page without one
  // means the recovery session expired or was never started.
  const resetToken = (await cookies()).get(PASSWORD_RESET_COOKIE_NAME)?.value;
  if (!resetToken) redirect("/forgot-password");

  return <ResetPasswordView />;
}
