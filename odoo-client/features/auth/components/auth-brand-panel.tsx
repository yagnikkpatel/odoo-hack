import {
  CalendarCheck2Icon,
  CircleDollarSignIcon,
  UsersRoundIcon,
} from "lucide-react";

import { siteConfig } from "@/lib/site-config";

const capabilities = [
  {
    icon: UsersRoundIcon,
    label: "Employee profiles, contracts and working schedules",
  },
  {
    icon: CalendarCheck2Icon,
    label: "Attendance, time off, allocations and approvals",
  },
  {
    icon: CircleDollarSignIcon,
    label: "Payruns, payslips and live payroll reporting",
  },
] as const;

export function AuthBrandPanel() {
  return (
    <aside className="bg-muted/40 hidden flex-col justify-center gap-8 rounded-r-2xl border-s p-8 lg:flex">
      <div>
        <p className="text-2xl font-semibold tracking-tight">{siteConfig.name}</p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-balance">
          {siteConfig.description}
        </p>
      </div>

      <ul className="flex flex-col gap-5">
        {capabilities.map(({ icon: CapabilityIcon, label }) => (
          <li key={label} className="flex items-center gap-3.5">
            <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <CapabilityIcon className="size-4" />
            </span>
            <span className="text-sm leading-relaxed">{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
