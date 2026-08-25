export default function DocumentTypesLoading() {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mb-4 h-12 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700 sm:max-w-sm" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
          />
        ))}
      </div>
    </div>
  );
}
