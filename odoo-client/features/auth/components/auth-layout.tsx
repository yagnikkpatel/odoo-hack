import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AuthBackdrop } from "./auth-backdrop";
import { AuthBrandPanel } from "./auth-brand-panel";
import { AuthTopBar } from "./auth-top-bar";

type AuthLayoutProps = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

const cardSurface =
  "bg-card/95 supports-[backdrop-filter]:bg-card/85 dark:bg-popover/95 dark:supports-[backdrop-filter]:bg-popover/85";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: AuthLayoutProps) {
  return (
    <AuthBackdrop>
      <AuthTopBar />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pt-2 pb-14 sm:px-6">
        <div
          className={cn(
            cardSurface,
            "w-full rounded-2xl border shadow-2xl backdrop-blur-2xl",
            wide
              ? "max-w-md lg:grid lg:max-w-4xl lg:grid-cols-2"
              : "max-w-md",
          )}
        >
          <div className="[&_input]:bg-background/80 dark:[&_input]:bg-input/60 flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm text-pretty">
                {subtitle}
              </p>
            </div>

            {children}

            {footer ? (
              <p className="text-muted-foreground text-center text-sm">
                {footer}
              </p>
            ) : null}
          </div>

          {wide ? <AuthBrandPanel /> : null}
        </div>
      </main>
    </AuthBackdrop>
  );
}
