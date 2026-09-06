"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type AuthBackdropProps = {
  children: ReactNode;
};

export function AuthBackdrop({ children }: AuthBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    root.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    root.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  const offScreen = { "--spot-x": "-100vw", "--spot-y": "-100vh" } as CSSProperties;

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      style={offScreen}
      className="group/backdrop bg-background relative isolate flex min-h-svh flex-col overflow-hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-30 scale-105">
        {/* Static dashboard preview behind the sign-in modal. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/login-dashboard.png"
          alt=""
          className="size-full object-cover opacity-90 blur-[16px] saturate-[0.3]"
        />
      </div>

      <div aria-hidden className="bg-muted/75 pointer-events-none absolute inset-0 -z-20" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 scale-105 opacity-0 transition-opacity duration-500 group-hover/backdrop:opacity-100 motion-reduce:hidden"
        style={{
          maskImage: "radial-gradient(circle 300px at var(--spot-x) var(--spot-y), black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle 300px at var(--spot-x) var(--spot-y), black 0%, transparent 70%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/login-dashboard.png" alt="" className="size-full object-cover" />
      </div>

      {children}
    </div>
  );
}
