"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/error/error-state";
import { Button } from "@/features/nexacrm/components/ui/button";

export default function RootError({
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
    <ErrorState
      title="Something went wrong"
      description="We hit an unexpected error while loading this page. Try again, or head back to your dashboard."
      action={
        <Button variant="outline" size="lg" onClick={reset}>
          Try again
        </Button>
      }
      className="bg-background min-h-svh"
    />
  );
}
