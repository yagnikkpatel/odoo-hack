import type { Metadata } from "next";

import { ErrorState } from "@/components/error/error-state";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <ErrorState
      title="We couldn't find that page"
      description="The page you're looking for has been moved, renamed, or never existed. Head back to your dashboard to pick up where you left off."
      className="bg-background min-h-svh"
    />
  );
}
