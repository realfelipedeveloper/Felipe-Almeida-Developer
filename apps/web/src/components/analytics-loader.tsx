'use client';

import { useEffect } from 'react';

const CONSENT_EVENT = 'fad:cookie-consent';
const SCRIPT_ATTRIBUTE = 'data-fad-analytics';

export function AnalyticsLoader() {
  useEffect(() => {
    // Links LGPD carregam token no fragmento e nunca devem executar terceiros.
    if (window.location.pathname.endsWith('/privacidade/verify')) return;
    const configured = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL?.trim();
    if (!configured) return;

    let scriptUrl: URL;
    try {
      scriptUrl = new URL(configured);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(scriptUrl.protocol)) return;
    if (process.env.NODE_ENV === 'production' && scriptUrl.protocol !== 'https:') return;
    const allowedOrigins = new Set([
      window.location.origin,
      ...(process.env.NEXT_PUBLIC_ANALYTICS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]);
    if (!allowedOrigins.has(scriptUrl.origin)) return;

    const sync = () => {
      const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTRIBUTE}]`);
      if (window.localStorage.getItem('fad-cookie-consent') !== 'analytics') {
        existing?.remove();
        return;
      }
      if (existing) return;
      const script = document.createElement('script');
      script.src = scriptUrl.toString();
      script.async = true;
      script.setAttribute(SCRIPT_ATTRIBUTE, 'true');
      document.head.appendChild(script);
    };

    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  return null;
}
