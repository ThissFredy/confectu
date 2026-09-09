import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { PrivateHeader } from "@/modules/auth/components/PrivateHeader";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated" || authState.status === "error") {
    redirect("/login");
  }

  if (authState.status === "inactive") {
    redirect("/account-disabled");
  }

  if (authState.profile?.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-full flex-col">
      <PrivateHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
