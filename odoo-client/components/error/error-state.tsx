import Link from "next/link";
import type { ReactNode } from "react";

import Error02Illustration from "@/components/error/error-02-illustration";
import { Button } from "@/features/nexacrm/components/ui/button";
import { cn } from "@/lib/utils";

const DASHBOARD_HREF = "/dashboard";

type ErrorStateProps = {
  /** Big headline above the title. `404` for not-found, defaults to `Oops!`. */
  heading?: string;
  title: string;
  description: string;
  /** Extra action rendered beside "Back to dashboard" — a retry button, say. */
  action?: ReactNode;
  className?: string;
};

/**
 * The single full-page error surface, shared by `not-found`, the route error
 * boundaries and the global boundary so every failure looks the same.
 *
 * Layout and illustration are shadcn-studio's `error-page-02` block
 * (`@ss-pages/error-page-02`), trimmed to the illustration + copy + one way
 * back to the dashboard. The SVG is painted entirely with theme tokens, so it
 * takes the `modern-minimal` blue from the root layout with no overrides.
 */
export function ErrorState({
  heading = "Oops!",
  title,
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-col items-center justify-center gap-12 px-8 py-8 sm:py-16 lg:gap-24 lg:py-24",
        className,
      )}
    >
      <Error02Illustration aria-hidden className="h-[clamp(300px,50vh,500px)] max-sm:h-75" />

      <div className="text-center">
        <p className="mb-6 text-5xl font-semibold">{heading}</p>
        <h1 className="mb-1.5 text-3xl font-semibold text-balance">{title}</h1>
        <p className="text-muted-foreground mb-6 max-w-md text-pretty">
          {description}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href={DASHBOARD_HREF} />}>
            Back to dashboard
          </Button>
          {action}
        </div>
      </div>
    </div>
  );
}
