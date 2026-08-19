import { AdminHeader } from "@/modules/auth/components/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <AdminHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
