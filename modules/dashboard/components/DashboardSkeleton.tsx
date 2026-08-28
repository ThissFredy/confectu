export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="h-3 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-1 h-7 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div>
                <div className="h-3 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-1 h-7 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
