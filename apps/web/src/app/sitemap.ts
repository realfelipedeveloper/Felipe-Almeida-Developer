import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { getArticles, getNews, getProjects } from '@/lib/api/client';
import { absoluteUrl, localizedPath } from '@/lib/seo';

const staticRoutes = ['', 'sobre', 'projetos', 'artigos', 'noticias', 'contato', 'newsletter', 'privacidade', 'cookies'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticRoutes.map((route) => ({
      url: absoluteUrl(localizedPath(locale, route)),
      lastModified: now,
      changeFrequency: route === '' ? 'weekly' : 'monthly',
      priority: route === '' ? 1 : 0.7,
    })),
  );

  const dynamic = await Promise.all(
    locales.map(async (locale) => {
      const [projects, articles, news] = await Promise.all([
        getProjects({ locale, page: 1, limit: 50 }),
        getArticles({ locale, page: 1, limit: 50 }),
        getNews({ locale, page: 1, limit: 50 }),
      ]);

      return [
        ...projects.data.map((item) => ({ url: absoluteUrl(`/${locale}/projetos/${item.slug}`), lastModified: item.endedAt ? new Date(item.endedAt) : now })),
        ...articles.data.map((item) => ({ url: absoluteUrl(`/${locale}/artigos/${item.slug}`), lastModified: item.publishedAt ? new Date(item.publishedAt) : now })),
        ...news.data.map((item) => ({ url: absoluteUrl(`/${locale}/noticias/${item.slug}`), lastModified: item.publishedAt ? new Date(item.publishedAt) : now })),
      ] satisfies MetadataRoute.Sitemap;
    }),
  );

  return [...staticEntries, ...dynamic.flat()];
}
