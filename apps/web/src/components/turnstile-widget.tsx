'use client';

import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      reset: () => void;
    };
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget() {
  if (!siteKey || siteKey.startsWith('TODO')) return null;

  return (
    <div className="space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="dark"
      />
    </div>
  );
}

export function resetTurnstile(): void {
  if (typeof window !== 'undefined') {
    window.turnstile?.reset();
  }
}
