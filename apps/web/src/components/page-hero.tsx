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
      <div className="max-w-5xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-title mt-5 text-4xl sm:text-5xl md:text-7xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-600 md:text-lg dark:text-zinc-400">
          {description}
        </p>
      </div>
    </section>
  );
}
