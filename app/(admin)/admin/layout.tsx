import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { AdminHeader } from "@/modules/auth/components/AdminHeader";
import { AdminSidebar } from "@/modules/admin/components/AdminSidebar";

export default async function AdminLayout({
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

  if (authState.status === "needs_onboarding") {
    redirect("/onboarding");
  }

  if (authState.profile?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-col">
      <AdminHeader />
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
