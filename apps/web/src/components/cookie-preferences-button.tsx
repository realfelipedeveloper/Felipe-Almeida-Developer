'use client';

export function CookiePreferencesButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('fad:cookie-preferences'))}
      className="hover:text-zinc-950 dark:hover:text-white"
    >
      {label}
    </button>
  );
}
