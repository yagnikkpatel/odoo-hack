import { apiRequest } from "@/lib/api-client";

type LoginInput = {
  email: string;
  password: string;
};

export async function login(input: LoginInput & { rememberMe: boolean }) {
  await apiRequest<{ success: true }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
