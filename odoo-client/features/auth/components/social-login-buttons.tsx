"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const providers = [
  {
    name: "Google",
    icon: "/images/brands/google-icon.webp",
    enabled: false,
  },
  {
    name: "Microsoft",
    icon: "/images/brands/microsoft-icon.webp",
    enabled: false,
  },
] as const;

export function SocialLoginButtons() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => (
          <Button
            key={provider.name}
            type="button"
            variant="outline"
            size="lg"
            disabled={!provider.enabled}
            title={
              provider.enabled
                ? `Continue with ${provider.name}`
                : `${provider.name} sign in is not configured yet`
            }
          >
            <Image
              src={provider.icon}
              alt=""
              aria-hidden="true"
              width={16}
              height={16}
              className="size-4 rounded-full object-contain"
            />
            {provider.name}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground shrink-0 text-xs">
          or continue with
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
