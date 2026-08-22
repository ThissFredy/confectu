"use client";

interface RetryButtonProps {
  label?: string;
}

export function RetryButton({ label = "Reintentar" }: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {label}
    </button>
  );
}
