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
  labels: { title: string; text: string; accept: string; essential: string; policy: string };
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem('fad-cookie-consent'));
  }, []);

  function choose(value: Consent) {
    window.localStorage.setItem('fad-cookie-consent', value);
    window.dispatchEvent(new CustomEvent('fad:cookie-consent', { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{labels.title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {labels.text}{' '}
            <Link href={`/${locale}/cookies`} className="font-semibold underline underline-offset-4">{labels.policy}</Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => choose('essential')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
            {labels.essential}
          </button>
          <button type="button" onClick={() => choose('analytics')} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            {labels.accept}
          </button>
        </div>
      </div>
    </aside>
  );
}
