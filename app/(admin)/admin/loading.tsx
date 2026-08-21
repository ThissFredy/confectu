import { AdminDashboardSkeleton } from "@/modules/admin/components/AdminDashboardSkeleton";

export default function AdminLoading() {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <AdminDashboardSkeleton />
    </div>
  );
}
