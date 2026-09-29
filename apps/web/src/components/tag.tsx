export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-200/90 bg-zinc-100/70 px-2.5 py-1 font-mono text-[10px] font-semibold text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.035] dark:text-zinc-400">
      {children}
    </span>
  );
}
