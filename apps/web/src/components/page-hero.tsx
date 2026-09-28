export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-16 md:pb-16 md:pt-24">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{eyebrow}</p>
      <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-[-0.045em] text-slate-950 md:text-6xl dark:text-white">{title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">{description}</p>
    </section>
  );
}
