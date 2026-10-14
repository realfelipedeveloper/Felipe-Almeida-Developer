'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';

type Consent = 'analytics' | 'essential';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const PRIVACY_POLICY_VERSION = '2026-10-11';
const CONSENT_SUBJECT_KEY = 'fad-consent-subject';

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
    const reopen = () => setVisible(true);
    window.addEventListener('fad:cookie-preferences', reopen);
    return () => window.removeEventListener('fad:cookie-preferences', reopen);
  }, []);

  function choose(value: Consent) {
    const previous = window.localStorage.getItem('fad-cookie-consent');
    let subjectId = window.localStorage.getItem(CONSENT_SUBJECT_KEY);
    if (!subjectId) {
      subjectId = window.crypto.randomUUID();
      window.localStorage.setItem(CONSENT_SUBJECT_KEY, subjectId);
    }
    window.localStorage.setItem('fad-cookie-consent', value);
    window.dispatchEvent(new CustomEvent('fad:cookie-consent', { detail: value }));
    setVisible(false);
    void fetch(`${API_BASE_URL}/api/privacy/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        subjectId,
        granted: value === 'analytics',
        policyVersion: PRIVACY_POLICY_VERSION,
        locale,
      }),
      keepalive: true,
    }).catch(() => undefined);

    if (previous === 'analytics' && value === 'essential') {
      window.dispatchEvent(new Event('fad:analytics-revoke'));
      for (const storage of [window.localStorage, window.sessionStorage]) {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key && /^(?:_ga|_gid|_gat|plausible|analytics)/i.test(key)) storage.removeItem(key);
        }
      }
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0]?.trim();
        if (name && /^(?:_ga|_gid|_gat|plausible)/i.test(name)) {
          document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        }
      }
      window.location.reload();
    }
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
          <button type="button" onClick={() => choose('essential')} className="btn-secondary">
            {labels.essential}
          </button>
          <button type="button" onClick={() => choose('analytics')} className="btn-primary">
            {labels.accept}
          </button>
        </div>
      </div>
    </aside>
  );
}
