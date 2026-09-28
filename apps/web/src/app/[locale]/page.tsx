import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { isLocale } from '@/i18n/config';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale = rawLocale;
  const t = await getTranslations();

  const cards = [
    ['about', 'aboutText'],
    ['projects', 'projectsText'],
    ['articles', 'articlesText'],
    ['newsletter', 'newsletterText'],
  ] as const;

  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href={`/${locale}`} className="font-bold tracking-tight">
            FAD<span className="text-slate-400">.dev</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
            <a href="#sobre" className="hover:text-slate-950 dark:hover:text-white">{t('nav.about')}</a>
            <a href="#projetos" className="hover:text-slate-950 dark:hover:text-white">{t('nav.projects')}</a>
            <a href="#artigos" className="hover:text-slate-950 dark:hover:text-white">{t('nav.articles')}</a>
            <a href="#contato" className="hover:text-slate-950 dark:hover:text-white">{t('nav.contact')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[74vh] max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {t('hero.eyebrow')}
          </p>
          <h1 className="max-w-4xl text-5xl font-black tracking-[-0.05em] text-slate-950 dark:text-white md:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            {t('hero.description')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#projetos" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
              {t('hero.projects')}
            </a>
            <a href="#contato" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900">
              {t('hero.contact')}
            </a>
          </div>
          <div className="mt-8 inline-flex max-w-xl items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <span className="mt-1 block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">{t('status.title')}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('status.description')}</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-slate-300/30 to-slate-600/10 blur-2xl dark:from-slate-500/20 dark:to-slate-900/20" />
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <Image
              src="/images/Eu.png"
              alt="Felipe Almeida"
              width={1170}
              height={1560}
              priority
              className="aspect-[4/5] w-full object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-2">
          {cards.map(([title, text], index) => (
            <article
              key={title}
              id={title === 'about' ? 'sobre' : title === 'projects' ? 'projetos' : title === 'articles' ? 'artigos' : undefined}
              className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="text-xs font-bold text-slate-400">0{index + 1}</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{t(`sections.${title}`)}</h2>
              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{t(`sections.${text}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contato" className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-8 text-white dark:border-slate-800 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{t('nav.contact')}</p>
          <h2 className="mt-3 text-3xl font-bold">API base disponível em localhost:3333</h2>
          <p className="mt-3 max-w-2xl text-slate-300">Abra o Swagger em <code className="rounded bg-white/10 px-2 py-1">http://localhost:3333/docs</code>. O formulário real será conectado ao módulo de contato em uma das próximas partes.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} {t('footer')}
      </footer>
    </main>
  );
}
