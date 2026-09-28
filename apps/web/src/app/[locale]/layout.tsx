import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CookieConsent } from '@/components/cookie-consent';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  const locale: Locale = rawLocale;
  const messages = await getMessages();
  const nav = await getTranslations({ locale, namespace: 'nav' });
  const footer = await getTranslations({ locale, namespace: 'footer' });
  const cookies = await getTranslations({ locale, namespace: 'cookiesBanner' });

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <SiteHeader
            locale={locale}
            labels={{
              home: nav('home'),
              about: nav('about'),
              projects: nav('projects'),
              articles: nav('articles'),
              news: nav('news'),
              contact: nav('contact'),
              menu: nav('menu'),
            }}
          />
          {children}
          <SiteFooter
            locale={locale}
            tagline={footer('tagline')}
            rights={footer('rights')}
            privacy={footer('privacy')}
            cookies={footer('cookies')}
            rss={footer('rss')}
          />
          <CookieConsent
            locale={locale}
            labels={{
              title: cookies('title'),
              text: cookies('text'),
              accept: cookies('accept'),
              essential: cookies('essential'),
              policy: cookies('policy'),
            }}
          />
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('fad-theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}",
          }}
        />
      </body>
    </html>
  );
}
