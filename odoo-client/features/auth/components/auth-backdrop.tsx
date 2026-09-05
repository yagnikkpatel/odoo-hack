import type { ReactNode } from "react";

type AuthBackdropProps = {
  children: ReactNode;
};

export function AuthBackdrop({ children }: AuthBackdropProps) {
  return (
    <div className="bg-muted/40 dark:bg-background flex min-h-svh flex-col">
      {children}
    </div>
  );
}
