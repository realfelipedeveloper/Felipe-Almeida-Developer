import { describe, expect, it } from 'vitest';
import { languageAlternates, localizedPath } from './seo';

describe('seo helpers', () => {
  it('gera caminho localizado', () => {
    expect(localizedPath('pt-BR', 'projetos')).toBe('/pt-BR/projetos');
  });

  it('gera hreflang para os três idiomas e x-default', () => {
    const alternates = languageAlternates('artigos');
    expect(Object.keys(alternates)).toEqual(['pt-BR', 'en', 'es', 'x-default']);
  });
});
