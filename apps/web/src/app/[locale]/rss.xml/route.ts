import { isLocale } from '@/i18n/config';
import { getArticles } from '@/lib/api/client';
import { absoluteUrl } from '@/lib/seo';

function xml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char] ?? char);
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response('Not found', { status: 404 });

  const articles = await getArticles({ locale, page: 1, limit: 50 });
  const title = locale === 'pt-BR' ? 'Felipe Almeida Developer — Artigos' : locale === 'en' ? 'Felipe Almeida Developer — Articles' : 'Felipe Almeida Developer — Artículos';
  const description = locale === 'pt-BR' ? 'Artigos sobre engenharia de software, arquitetura, segurança e carreira.' : locale === 'en' ? 'Articles about software engineering, architecture, security and career.' : 'Artículos sobre ingeniería de software, arquitectura, seguridad y carrera.';

  const items = articles.data.map((article) => `
    <item>
      <title>${xml(article.title)}</title>
      <link>${xml(absoluteUrl(`/${locale}/artigos/${article.slug}`))}</link>
      <guid>${xml(article.id)}</guid>
      <description>${xml(article.summary)}</description>
      ${article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : ''}
    </item>`).join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${xml(title)}</title>
      <link>${xml(absoluteUrl(`/${locale}/artigos`))}</link>
      <description>${xml(description)}</description>
      <language>${xml(locale)}</language>
      ${items}
    </channel>
  </rss>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
