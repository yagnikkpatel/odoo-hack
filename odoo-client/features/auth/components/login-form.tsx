"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { siteConfig } from "@/lib/site-config";

import { login } from "../auth-service";

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const initialFormState: LoginFormState = {
  email: "",
  password: "",
  rememberMe: false,
};

export function LoginForm() {
  const router = useRouter();
  const [formState, setFormState] = useState(initialFormState);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setRecoveryMessage(null);
    setSubmitError(null);

    try {
      await login(formState);

      router.replace(siteConfig.authenticatedHome);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.";

      setSubmitError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          value={formState.email}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            className="text-primary text-xs underline-offset-4 hover:underline"
            onClick={() =>
              setRecoveryMessage(
                "Password recovery will be connected when account management is added.",
              )
            }
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={formState.password}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember-me"
          checked={formState.rememberMe}
          onCheckedChange={(checked) =>
            setFormState((current) => ({
              ...current,
              rememberMe: checked === true,
            }))
          }
        />
        <Label htmlFor="remember-me" className="text-sm font-normal">
          Remember me for 30 days
        </Label>
      </div>

      {recoveryMessage ? (
        <p className="text-muted-foreground text-xs" role="status">
          {recoveryMessage}
        </p>
      ) : null}

      {submitError ? (
        <p id="login-error" className="text-destructive text-sm" role="alert">
          {submitError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-2 w-full"
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
