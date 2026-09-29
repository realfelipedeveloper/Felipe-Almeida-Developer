import { NewsletterTokenAction } from '@/components/newsletter-token-action';
import { isLocale } from '@/i18n/config';

export default async function NewsletterUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token = '' } = await searchParams;

  if (!isLocale(locale)) return null;

  return (
    <main>
      <NewsletterTokenAction
        locale={locale}
        token={token}
        action="unsubscribe"
      />
    </main>
  );
}
