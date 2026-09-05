"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";

import { ErrorState } from "@/components/error/error-state";
import { Button } from "@/features/nexacrm/components/ui/button";
import { themePresets } from "@/features/nexacrm/utils/theme-presets";

import "./globals.css";

// `global-error` replaces the root layout, so the preset the layout normally
// applies inline has to be reapplied here or the blue collapses to the
// stylesheet's neutral fallback.
const themeStyle = Object.fromEntries(
  Object.entries(themePresets["modern-minimal"].styles.light).map(
    ([key, value]) => [`--${key}`, value],
  ),
) as CSSProperties;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      data-theme-preset="modern-minimal"
      style={themeStyle}
      className="h-full antialiased"
    >
      <body className="bg-background text-foreground min-h-full font-sans">
        <ErrorState
          heading="Oops!"
          title="Something went wrong"
          description="PeoplePay360 ran into an unexpected error and couldn't finish loading. Try again, or head back to your dashboard."
          action={
            <Button variant="outline" size="lg" onClick={reset}>
              Try again
            </Button>
          }
          className="min-h-svh"
        />
      </body>
    </html>
  );
}
