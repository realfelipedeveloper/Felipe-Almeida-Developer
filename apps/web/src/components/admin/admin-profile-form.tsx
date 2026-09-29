'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  adminFetch,
  AdminApiError,
} from '@/lib/admin/admin-api';
import {
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

type LocaleKey = 'pt-BR' | 'en' | 'es';

const locales: LocaleKey[] = ['pt-BR', 'en', 'es'];
const prismaToLocale: Record<string, LocaleKey> = {
  PT_BR: 'pt-BR',
  EN: 'en',
  ES: 'es',
};

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
  return {
    locale,
    fullName: '',
    headline: '',
    summary: '',
    bio: '',
    seoTitle: '',
    seoDescription: '',
  };
}

export function AdminProfileForm() {
  const [profile, setProfile] = useState<ProfileResponse | null>(
    null,
  );
  const [translations, setTranslations] = useState<
    TranslationState[]
  >(locales.map(blankTranslation));
  const [socialLinks, setSocialLinks] = useState<
    SocialLinkState[]
  >([]);
  const [publicEmail, setPublicEmail] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [availableForWork, setAvailableForWork] =
    useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    adminFetch<ProfileResponse>('/api/admin/content/profile')
      .then((data) => {
        setProfile(data);
        setPublicEmail(data.publicEmail ?? '');
        setPublicLocation(data.publicLocation ?? '');
        setAvailableForWork(data.availableForWork);
        setTranslations(
          locales.map((locale) => {
            const source = data.translations.find(
              (item) =>
                prismaToLocale[item.locale] === locale,
            );

            return source
              ? {
                  locale,
                  fullName: source.fullName,
                  headline: source.headline,
                  summary: source.summary,
                  bio: source.bio,
                  seoTitle: source.seoTitle ?? '',
                  seoDescription:
                    source.seoDescription ?? '',
                }
              : blankTranslation(locale);
          }),
        );
        setSocialLinks(
          data.socialLinks.map((item) => ({
            ...item,
            iconKey: item.iconKey ?? '',
          })),
        );
      })
      .catch((cause: Error) =>
        setFeedback({
          variant: 'error',
          title: 'Não foi possível carregar o perfil.',
          message: cause.message,
        }),
      );
  }, []);

  function updateTranslation(
    index: number,
    field: keyof TranslationState,
    value: string,
  ) {
    setTranslations((items) =>
      items.map((item, current) =>
        current === index
          ? { ...item, [field]: value }
          : item,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);

    try {
      const updated =
        await adminFetch<ProfileResponse>(
          '/api/admin/content/profile',
          {
            method: 'PATCH',
            body: JSON.stringify({
              publicEmail: publicEmail || null,
              publicLocation: publicLocation || null,
              availableForWork,
              avatarMediaId: profile.avatarMediaId,
              resumeMediaId: profile.resumeMediaId,
              translations: translations.map((item) => ({
                ...item,
                seoTitle: item.seoTitle || null,
                seoDescription:
                  item.seoDescription || null,
              })),
              socialLinks: socialLinks.map(
                (item, index) => ({
                  ...item,
                  iconKey: item.iconKey || null,
                  sortOrder: index,
                }),
              ),
            }),
          },
        );

      setProfile(updated);
      setEditing(false);
      setFeedback({
        variant: 'success',
        title: 'Perfil atualizado.',
        message: 'As alterações foram salvas com sucesso.',
      });
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível salvar o perfil.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível salvar o perfil.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!profile && !feedback) {
    return (
      <p className="text-slate-400">Carregando perfil…</p>
    );
  }

  const pt =
    translations.find((item) => item.locale === 'pt-BR') ??
    translations[0];

  return (
    <>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">ADMIN / PERFIL</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Perfil público
            </h1>
            <p className="mt-2 text-slate-400">
              Conteúdo exibido na Home e na página Sobre.
            </p>
          </div>

          <button
            type="button"
            disabled={!profile}
            onClick={() => setEditing(true)}
            className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
          >
            Editar perfil
          </button>
        </div>

        {profile ? (
          <section className="site-panel mt-8 p-6">
            <p className="eyebrow">VISÃO GERAL</p>
            <h2 className="mt-3 text-2xl font-bold">
              {pt?.fullName || 'Perfil sem nome'}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {pt?.headline || 'Headline não informada'}
            </p>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">E-mail público</dt>
                <dd className="mt-1 font-semibold">
                  {publicEmail || 'Não informado'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Localização</dt>
                <dd className="mt-1 font-semibold">
                  {publicLocation || 'Não informada'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Disponibilidade</dt>
                <dd className="mt-1 font-semibold">
                  {availableForWork
                    ? 'Disponível'
                    : 'Indisponível'}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>

      <AdminModal
        open={editing}
        onClose={() => {
          if (!saving) setEditing(false);
        }}
        eyebrow="ADMIN / PERFIL"
        title="Editar perfil público"
        description="Todos os campos de manutenção do perfil ficam concentrados neste modal."
        size="xl"
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
      >
        <form onSubmit={submit} className="space-y-8">
          <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-2">
            <label className="text-sm font-semibold">
              E-mail público
              <input
                type="email"
                value={publicEmail}
                onChange={(event) =>
                  setPublicEmail(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold">
              Localização pública
              <input
                value={publicLocation}
                onChange={(event) =>
                  setPublicLocation(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
              />
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={availableForWork}
                onChange={(event) =>
                  setAvailableForWork(
                    event.target.checked,
                  )
                }
              />
              Disponível para oportunidades
            </label>
          </section>

          {translations.map((translation, index) => (
            <section
              key={translation.locale}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h3 className="text-xl font-bold">
                Conteúdo · {translation.locale}
              </h3>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field
                  label="Nome"
                  value={translation.fullName}
                  onChange={(value) =>
                    updateTranslation(
                      index,
                      'fullName',
                      value,
                    )
                  }
                />
                <Field
                  label="Headline"
                  value={translation.headline}
                  onChange={(value) =>
                    updateTranslation(
                      index,
                      'headline',
                      value,
                    )
                  }
                />
                <Area
                  label="Resumo"
                  value={translation.summary}
                  onChange={(value) =>
                    updateTranslation(
                      index,
                      'summary',
                      value,
                    )
                  }
                />
                <Area
                  label="Biografia"
                  value={translation.bio}
                  onChange={(value) =>
                    updateTranslation(index, 'bio', value)
                  }
                />
                <Field
                  label="SEO title"
                  value={translation.seoTitle}
                  onChange={(value) =>
                    updateTranslation(
                      index,
                      'seoTitle',
                      value,
                    )
                  }
                />
                <Field
                  label="SEO description"
                  value={translation.seoDescription}
                  onChange={(value) =>
                    updateTranslation(
                      index,
                      'seoDescription',
                      value,
                    )
                  }
                />
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold">
                Links sociais
              </h3>
              <button
                type="button"
                onClick={() =>
                  setSocialLinks((items) => [
                    ...items,
                    {
                      label: '',
                      url: '',
                      iconKey: '',
                      sortOrder: items.length,
                      visible: true,
                    },
                  ])
                }
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm"
              >
                Adicionar
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {socialLinks.map((link, index) => (
                <div
                  key={`${index}-${link.url}`}
                  className="grid gap-3 rounded-xl border border-slate-800 p-4 md:grid-cols-[1fr_2fr_1fr_auto]"
                >
                  <input
                    aria-label="Rótulo"
                    placeholder="Rótulo"
                    value={link.label}
                    onChange={(event) =>
                      setSocialLinks((items) =>
                        items.map((item, current) =>
                          current === index
                            ? {
                                ...item,
                                label:
                                  event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />

                  <input
                    aria-label="URL"
                    placeholder="https://..."
                    value={link.url}
                    onChange={(event) =>
                      setSocialLinks((items) =>
                        items.map((item, current) =>
                          current === index
                            ? {
                                ...item,
                                url: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />

                  <input
                    aria-label="Ícone"
                    placeholder="linkedin"
                    value={link.iconKey}
                    onChange={(event) =>
                      setSocialLinks((items) =>
                        items.map((item, current) =>
                          current === index
                            ? {
                                ...item,
                                iconKey:
                                  event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setSocialLinks((items) =>
                        items.filter(
                          (_, current) =>
                            current !== index,
                        ),
                      )
                    }
                    className="text-sm text-red-300"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-700 px-6 py-3 font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              disabled={saving}
              className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminFeedbackModal
        open={Boolean(feedback)}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'success'}
        title={feedback?.title}
        message={feedback?.message ?? ''}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold md:col-span-2">
      {label}
      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required
        rows={6}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
      />
    </label>
  );
}
