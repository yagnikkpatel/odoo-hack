import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";
import { SocialLoginButtons } from "./social-login-buttons";

export function LoginView() {
  return (
    <AuthLayout
      wide
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer="Need access? Contact your PeoplePay360 administrator."
    >
      <SocialLoginButtons />
      <LoginForm />
    </AuthLayout>
  );
}
