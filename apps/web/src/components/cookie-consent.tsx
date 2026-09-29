'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';

type Consent = 'analytics' | 'essential';

export function CookieConsent({
  locale,
  labels,
}: {
  locale: Locale;
  labels: {
    title: string;
    text: string;
    accept: string;
    essential: string;
    policy: string;
  };
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem('fad-cookie-consent'));
  }, []);

  function choose(value: Consent) {
    window.localStorage.setItem('fad-cookie-consent', value);
    window.dispatchEvent(
      new CustomEvent('fad:cookie-consent', { detail: value }),
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="site-panel fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-3xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold">{labels.title}</p>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-zinc-600 dark:text-zinc-400">
            {labels.text}{' '}
            <Link
              href={`/${locale}/cookies`}
              className="font-semibold underline underline-offset-4"
            >
              {labels.policy}
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose('essential')}
            className="btn-secondary"
          >
            {labels.essential}
          </button>
          <button
            type="button"
            onClick={() => choose('analytics')}
            className="btn-primary"
          >
            {labels.accept}
          </button>
        </div>
      </div>
    </aside>
  );
}
