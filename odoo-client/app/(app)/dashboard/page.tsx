import { BrandMark } from "@/components/brand/brand-mark";
import { verifySession } from "@/features/auth/session";

export default async function DashboardPage() {
  const user = await verifySession();

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center px-6 py-12">
      <section className="bg-card w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm">
        <BrandMark className="mx-auto size-10" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          PeoplePay360 workspace
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Signed in as {user.email}. The HR and payroll workspace will be assembled
          here next.
        </p>
      </section>
    </main>
  );
}
