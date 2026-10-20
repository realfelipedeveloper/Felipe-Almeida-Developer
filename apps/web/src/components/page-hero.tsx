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
    <section className="page-hero">
      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <div className="max-w-6xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-hero-title mt-7">{title}</h1>
          <div className="mt-8 flex max-w-4xl items-start gap-4 md:ml-[8.5%] md:mt-10">
            <span
              className="mt-3 h-px w-12 shrink-0 bg-gradient-to-r from-[var(--accent)] to-transparent"
              aria-hidden="true"
            />
            <p className="text-base leading-8 text-[var(--muted)] md:text-xl md:leading-9">
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
