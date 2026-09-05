import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";

export function LoginView() {
  return (
    <AuthLayout
      wide
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer="Need access? Contact your PeoplePay360 administrator."
    >
      <LoginForm />
    </AuthLayout>
  );
}
