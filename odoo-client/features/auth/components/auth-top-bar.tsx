import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/site-config";

export function AuthTopBar() {
  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
      <Link
        href="/login"
        aria-label={`${siteConfig.name} sign in`}
        className="focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3"
      >
        <BrandMark className="size-8 rounded-md" />
        <span className="text-base font-semibold tracking-tight">
          {siteConfig.name}
        </span>
      </Link>

      <ThemeToggle />
    </header>
  );
}
