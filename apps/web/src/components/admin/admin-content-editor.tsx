'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';

type Kind = 'projects' | 'articles' | 'news';
type LocaleKey = 'pt-BR' | 'en' | 'es';
const locales: LocaleKey[] = ['pt-BR', 'en', 'es'];
const prismaToLocale: Record<string, LocaleKey> = { PT_BR: 'pt-BR', EN: 'en', ES: 'es' };

interface TranslationState {
  locale: LocaleKey;
  title: string;
  slug: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  description: string;
  challenges: string;
  solution: string;
  results: string;
  bodyHtml: string;
  contentHtml: string;
}

interface Options {
  technologies: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; key: string; translations: Array<{ locale: string; label: string }> }>;
}

interface ExistingContent {
  id: string;
  publicationStatus: string;
  lifecycle?: string;
  featured?: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  coverMediaId?: string | null;
  sortOrder?: number;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  readingTimeMinutes?: number | null;
  authorProfileId?: string | null;
  translations: Array<Record<string, unknown> & { locale: string; title: string; slug: string; summary: string }>;
  technologies?: Array<{ technologyId: string }>;
  tags?: Array<{ tagId: string }>;
}

function blankTranslation(locale: LocaleKey): TranslationState {
  return {
    locale,
    title: '',
    slug: '',
    summary: '',
    seoTitle: '',
    seoDescription: '',
    description: '',
    challenges: '',
    solution: '',
    results: '',
    bodyHtml: '',
    contentHtml: '',
  };
}

function dateInput(value?: string | null, dateOnly = false) {
  if (!value) return '';
  return dateOnly ? value.slice(0, 10) : value.slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AdminContentEditor({ kind, id }: { kind: Kind; id?: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<Options>({ technologies: [], tags: [] });
  const [existing, setExisting] = useState<ExistingContent | null>(null);
  const [translations, setTranslations] = useState<TranslationState[]>(locales.map(blankTranslation));
  const [technologyIds, setTechnologyIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  const routeName = kind === 'projects' ? 'projetos' : kind === 'articles' ? 'artigos' : 'noticias';
  const singular = kind === 'projects' ? 'Projeto' : kind === 'articles' ? 'Artigo' : 'Notícia';

  useEffect(() => {
    adminFetch<Options>('/api/admin/content/options').then(setOptions).catch((cause: Error) => setError(cause.message));
    if (!id) return;
    adminFetch<ExistingContent>(`/api/admin/content/${kind}/${id}`)
      .then((data) => {
        setExisting(data);
        setTranslations(locales.map((locale) => {
          const source = data.translations.find((item) => prismaToLocale[item.locale] === locale);
          if (!source) return blankTranslation(locale);
          return {
            locale,
            title: String(source.title ?? ''),
            slug: String(source.slug ?? ''),
            summary: String(source.summary ?? ''),
            seoTitle: String(source.seoTitle ?? ''),
            seoDescription: String(source.seoDescription ?? ''),
            description: String(source.description ?? ''),
            challenges: String(source.challenges ?? ''),
            solution: String(source.solution ?? ''),
            results: String(source.results ?? ''),
            bodyHtml: String(source.bodyHtml ?? ''),
            contentHtml: String(source.contentHtml ?? ''),
          };
        }));
        setTechnologyIds(data.technologies?.map((item) => item.technologyId) ?? []);
        setTagIds(data.tags?.map((item) => item.tagId) ?? []);
        setLoaded(true);
      })
      .catch((cause: Error) => { setError(cause.message); setLoaded(true); });
  }, [id, kind]);

  const tagLabels = useMemo(() => options.tags.map((tag) => ({
    id: tag.id,
    label: tag.translations.find((item) => item.locale === 'PT_BR')?.label ?? tag.key,
  })), [options.tags]);

  function updateTranslation(index: number, field: keyof TranslationState, value: string) {
    setTranslations((items) => items.map((item, current) => current === index ? { ...item, [field]: value } : item));
  }

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const activeTranslations = translations.filter((item) => item.title.trim());

    try {
      let body: Record<string, unknown>;
      if (kind === 'projects') {
        body = {
          publicationStatus: String(form.get('publicationStatus')),
          lifecycle: String(form.get('lifecycle')),
          featured: form.get('featured') === 'on',
          startedAt: String(form.get('startedAt') ?? '') || null,
          endedAt: String(form.get('endedAt') ?? '') || null,
          repositoryUrl: String(form.get('repositoryUrl') ?? '') || null,
          demoUrl: String(form.get('demoUrl') ?? '') || null,
          coverMediaId: existing?.coverMediaId ?? null,
          sortOrder: Number(form.get('sortOrder') ?? 0),
          publishedAt: toIso(String(form.get('publishedAt') ?? '')),
          technologyIds,
          tagIds,
          translations: activeTranslations.map(({ bodyHtml: _body, contentHtml: _content, ...item }) => ({
            ...item,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
            challenges: item.challenges || null,
            solution: item.solution || null,
            results: item.results || null,
          })),
        };
      } else if (kind === 'articles') {
        body = {
          publicationStatus: String(form.get('publicationStatus')),
          authorProfileId: existing?.authorProfileId ?? null,
          coverMediaId: existing?.coverMediaId ?? null,
          readingTimeMinutes: String(form.get('readingTimeMinutes') ?? '') ? Number(form.get('readingTimeMinutes')) : null,
          scheduledAt: toIso(String(form.get('scheduledAt') ?? '')),
          publishedAt: toIso(String(form.get('publishedAt') ?? '')),
          tagIds,
          translations: activeTranslations.map(({ description: _description, challenges: _challenges, solution: _solution, results: _results, contentHtml: _content, ...item }) => ({
            ...item,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
          })),
        };
      } else {
        body = {
          publicationStatus: String(form.get('publicationStatus')),
          coverMediaId: existing?.coverMediaId ?? null,
          publishedAt: toIso(String(form.get('publishedAt') ?? '')),
          tagIds,
          translations: activeTranslations.map(({ description: _description, challenges: _challenges, solution: _solution, results: _results, bodyHtml: _body, ...item }) => ({
            ...item,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
          })),
        };
      }

      await adminFetch(`/api/admin/content/${kind}${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      router.push(`/admin/${routeName}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Não foi possível salvar o conteúdo.');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-slate-400">Carregando conteúdo…</p>;

  return (
    <div>
      <h1 className="text-4xl font-black tracking-tight">{id ? `Editar ${singular.toLowerCase()}` : `Novo ${singular.toLowerCase()}`}</h1>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-2 lg:grid-cols-3">
          <Select name="publicationStatus" label="Status" defaultValue={existing?.publicationStatus ?? 'DRAFT'} options={['DRAFT', 'PUBLISHED', 'ARCHIVED']} />
          {kind === 'projects' ? <Select name="lifecycle" label="Ciclo" defaultValue={existing?.lifecycle ?? 'IN_PROGRESS'} options={['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MAINTENANCE']} /> : null}
          {kind === 'projects' ? <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold"><input name="featured" type="checkbox" defaultChecked={existing?.featured ?? false} /> Projeto em destaque</label> : null}
          {kind === 'projects' ? <Input name="startedAt" label="Início" type="date" defaultValue={dateInput(existing?.startedAt, true)} /> : null}
          {kind === 'projects' ? <Input name="endedAt" label="Conclusão" type="date" defaultValue={dateInput(existing?.endedAt, true)} /> : null}
          {kind === 'projects' ? <Input name="sortOrder" label="Ordem" type="number" defaultValue={String(existing?.sortOrder ?? 0)} /> : null}
          {kind === 'projects' ? <Input name="repositoryUrl" label="Repositório" type="url" defaultValue={existing?.repositoryUrl ?? ''} /> : null}
          {kind === 'projects' ? <Input name="demoUrl" label="Demonstração" type="url" defaultValue={existing?.demoUrl ?? ''} /> : null}
          {kind === 'articles' ? <Input name="readingTimeMinutes" label="Tempo de leitura (min)" type="number" defaultValue={existing?.readingTimeMinutes ? String(existing.readingTimeMinutes) : ''} /> : null}
          {kind === 'articles' ? <Input name="scheduledAt" label="Agendamento" type="datetime-local" defaultValue={dateInput(existing?.scheduledAt)} /> : null}
          <Input name="publishedAt" label="Publicação" type="datetime-local" defaultValue={dateInput(existing?.publishedAt)} />
        </section>

        {kind === 'projects' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-bold">Tecnologias</h2><div className="mt-4 flex flex-wrap gap-3">{options.technologies.map((item) => <Check key={item.id} checked={technologyIds.includes(item.id)} label={item.name} onChange={() => toggle(item.id, technologyIds, setTechnologyIds)} />)}</div></section>
        ) : null}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-bold">Tags</h2><div className="mt-4 flex flex-wrap gap-3">{tagLabels.map((item) => <Check key={item.id} checked={tagIds.includes(item.id)} label={item.label} onChange={() => toggle(item.id, tagIds, setTagIds)} />)}</div></section>

        {translations.map((translation, index) => (
          <section key={translation.locale} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">{translation.locale}</h2>
            <p className="mt-1 text-xs text-slate-500">pt-BR é obrigatório. Os demais idiomas podem ser preenchidos depois.</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <EditorField label="Título" value={translation.title} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'title', value)} />
              <EditorField label="Slug" value={translation.slug} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'slug', value)} />
              <EditorArea label="Resumo" value={translation.summary} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'summary', value)} />
              {kind === 'projects' ? <EditorArea label="Descrição" value={translation.description} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'description', value)} /> : null}
              {kind === 'projects' ? <EditorArea label="Desafios" value={translation.challenges} onChange={(value) => updateTranslation(index, 'challenges', value)} /> : null}
              {kind === 'projects' ? <EditorArea label="Solução" value={translation.solution} onChange={(value) => updateTranslation(index, 'solution', value)} /> : null}
              {kind === 'projects' ? <EditorArea label="Resultados" value={translation.results} onChange={(value) => updateTranslation(index, 'results', value)} /> : null}
              {kind === 'articles' ? <EditorArea label="Conteúdo HTML" value={translation.bodyHtml} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'bodyHtml', value)} rows={12} /> : null}
              {kind === 'news' ? <EditorArea label="Conteúdo HTML" value={translation.contentHtml} required={translation.locale === 'pt-BR'} onChange={(value) => updateTranslation(index, 'contentHtml', value)} rows={12} /> : null}
              <EditorField label="SEO title" value={translation.seoTitle} onChange={(value) => updateTranslation(index, 'seoTitle', value)} />
              <EditorField label="SEO description" value={translation.seoDescription} onChange={(value) => updateTranslation(index, 'seoDescription', value)} />
            </div>
          </section>
        ))}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex gap-3"><button disabled={saving} className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button><button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-700 px-6 py-3 font-semibold">Cancelar</button></div>
      </form>
    </div>
  );
}

function Input({ name, label, type = 'text', defaultValue = '' }: { name: string; label: string; type?: string; defaultValue?: string }) {
  return <label className="text-sm font-semibold">{label}<input name={name} type={type} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>;
}
function Select({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: string[] }) {
  return <label className="text-sm font-semibold">{label}<select name={name} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label>;
}
function EditorField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="text-sm font-semibold">{label}<input value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" /></label>;
}
function EditorArea({ label, value, onChange, required = false, rows = 5 }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; rows?: number }) {
  return <label className="text-sm font-semibold md:col-span-2">{label}<textarea value={value} required={required} rows={rows} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm font-normal" /></label>;
}
