'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';

type LocaleKey = 'pt-BR' | 'en' | 'es';
const locales: LocaleKey[] = ['pt-BR', 'en', 'es'];
const prismaToLocale: Record<string, LocaleKey> = { PT_BR: 'pt-BR', EN: 'en', ES: 'es' };

interface TranslationState {
  locale: LocaleKey;
  fullName: string;
  headline: string;
  summary: string;
  bio: string;
  seoTitle: string;
  seoDescription: string;
}

interface SocialLinkState {
  label: string;
  url: string;
  iconKey: string;
  sortOrder: number;
  visible: boolean;
}

interface ProfileResponse {
  publicEmail: string | null;
  publicLocation: string | null;
  availableForWork: boolean;
  avatarMediaId: string | null;
  resumeMediaId: string | null;
  translations: Array<{
    locale: string;
    fullName: string;
    headline: string;
    summary: string;
    bio: string;
    seoTitle: string | null;
    seoDescription: string | null;
  }>;
  socialLinks: Array<{
    label: string;
    url: string;
    iconKey: string | null;
    sortOrder: number;
    visible: boolean;
  }>;
}

function blankTranslation(locale: LocaleKey): TranslationState {
  return { locale, fullName: '', headline: '', summary: '', bio: '', seoTitle: '', seoDescription: '' };
}

export function AdminProfileForm() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [translations, setTranslations] = useState<TranslationState[]>(locales.map(blankTranslation));
  const [socialLinks, setSocialLinks] = useState<SocialLinkState[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminFetch<ProfileResponse>('/api/admin/content/profile')
      .then((data) => {
        setProfile(data);
        setTranslations(locales.map((locale) => {
          const source = data.translations.find((item) => prismaToLocale[item.locale] === locale);
          return source ? {
            locale,
            fullName: source.fullName,
            headline: source.headline,
            summary: source.summary,
            bio: source.bio,
            seoTitle: source.seoTitle ?? '',
            seoDescription: source.seoDescription ?? '',
          } : blankTranslation(locale);
        }));
        setSocialLinks(data.socialLinks.map((item) => ({ ...item, iconKey: item.iconKey ?? '' })));
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  function updateTranslation(index: number, field: keyof TranslationState, value: string) {
    setTranslations((items) => items.map((item, current) => current === index ? { ...item, [field]: value } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setError('');
    setMessage('');
    try {
      const form = new FormData(event.currentTarget);
      const updated = await adminFetch<ProfileResponse>('/api/admin/content/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          publicEmail: String(form.get('publicEmail') ?? '') || null,
          publicLocation: String(form.get('publicLocation') ?? '') || null,
          availableForWork: form.get('availableForWork') === 'on',
          avatarMediaId: profile.avatarMediaId,
          resumeMediaId: profile.resumeMediaId,
          translations: translations.map((item) => ({
            ...item,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
          })),
          socialLinks: socialLinks.map((item, index) => ({ ...item, iconKey: item.iconKey || null, sortOrder: index })),
        }),
      });
      setProfile(updated);
      setMessage('Perfil atualizado com sucesso.');
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Não foi possível salvar o perfil.');
    }
  }

  if (!profile && !error) return <p className="text-slate-400">Carregando perfil…</p>;

  return (
    <div>
      <h1 className="text-4xl font-black tracking-tight">Perfil público</h1>
      <p className="mt-2 text-slate-400">Edite o conteúdo exibido na Home e na página Sobre nos três idiomas.</p>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-2">
          <label className="text-sm font-semibold">E-mail público<input name="publicEmail" type="email" defaultValue={profile?.publicEmail ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold">Localização pública<input name="publicLocation" defaultValue={profile?.publicLocation ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>
          <label className="flex items-center gap-3 text-sm font-semibold"><input name="availableForWork" type="checkbox" defaultChecked={profile?.availableForWork} /> Disponível para oportunidades</label>
        </section>

        {translations.map((translation, index) => (
          <section key={translation.locale} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Conteúdo · {translation.locale}</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Nome" value={translation.fullName} onChange={(value) => updateTranslation(index, 'fullName', value)} />
              <Field label="Headline" value={translation.headline} onChange={(value) => updateTranslation(index, 'headline', value)} />
              <Area label="Resumo" value={translation.summary} onChange={(value) => updateTranslation(index, 'summary', value)} />
              <Area label="Biografia" value={translation.bio} onChange={(value) => updateTranslation(index, 'bio', value)} />
              <Field label="SEO title" value={translation.seoTitle} onChange={(value) => updateTranslation(index, 'seoTitle', value)} />
              <Field label="SEO description" value={translation.seoDescription} onChange={(value) => updateTranslation(index, 'seoDescription', value)} />
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold">Links sociais</h2><button type="button" onClick={() => setSocialLinks((items) => [...items, { label: '', url: '', iconKey: '', sortOrder: items.length, visible: true }])} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Adicionar</button></div>
          <div className="mt-5 space-y-4">
            {socialLinks.map((link, index) => (
              <div key={`${index}-${link.url}`} className="grid gap-3 rounded-xl border border-slate-800 p-4 md:grid-cols-[1fr_2fr_1fr_auto]">
                <input aria-label="Rótulo" placeholder="Rótulo" value={link.label} onChange={(event) => setSocialLinks((items) => items.map((item, current) => current === index ? { ...item, label: event.target.value } : item))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
                <input aria-label="URL" placeholder="https://..." value={link.url} onChange={(event) => setSocialLinks((items) => items.map((item, current) => current === index ? { ...item, url: event.target.value } : item))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
                <input aria-label="Ícone" placeholder="linkedin" value={link.iconKey} onChange={(event) => setSocialLinks((items) => items.map((item, current) => current === index ? { ...item, iconKey: event.target.value } : item))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
                <button type="button" onClick={() => setSocialLinks((items) => items.filter((_, current) => current !== index))} className="text-sm text-red-300">Remover</button>
              </div>
            ))}
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        <button className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950">Salvar perfil</button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>;
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold md:col-span-2">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} required rows={6} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>;
}
