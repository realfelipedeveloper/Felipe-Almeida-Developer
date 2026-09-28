import { describe, expect, it } from 'vitest';

import { cleanSeedText, htmlToPlainText, safeExternalUrl } from './content';

describe('content helpers', () => {
  describe('cleanSeedText', () => {
    it('substitui texto TODO pelo fallback', () => {
      expect(cleanSeedText('TODO: revisar', 'fallback')).toBe('fallback');
    });

    it('mantém conteúdo válido', () => {
      expect(cleanSeedText('Conteúdo válido', 'fallback')).toBe('Conteúdo válido');
    });
  });

  describe('htmlToPlainText', () => {
    it('converte HTML em texto simples', () => {
      const resultado = htmlToPlainText('<p>Olá <strong>mundo</strong></p>');

      expect(resultado).toContain('Olá');
      expect(resultado).toContain('mundo');
      expect(resultado).not.toContain('<strong>');
    });

    it('remove conteúdo de scripts', () => {
      const resultado = htmlToPlainText('<p>Conteúdo seguro</p><script>alert("xss")</script>');

      expect(resultado).toContain('Conteúdo seguro');
      expect(resultado).not.toContain('alert');
      expect(resultado).not.toContain('xss');
      expect(resultado).not.toContain('<script>');
    });

    it('remove conteúdo de estilos', () => {
      const resultado = htmlToPlainText(
        '<style>body { display: none; }</style><p>Texto visível</p>',
      );

      expect(resultado).toContain('Texto visível');
      expect(resultado).not.toContain('display');
      expect(resultado).not.toContain('body');
    });

    it('não preserva atributos potencialmente maliciosos', () => {
      const resultado = htmlToPlainText('<img src="x" onerror="alert(1)"><p>Texto seguro</p>');

      expect(resultado).toContain('Texto seguro');
      expect(resultado).not.toContain('onerror');
      expect(resultado).not.toContain('alert');
    });

    it('processa HTML malformado sem expor marcação', () => {
      const resultado = htmlToPlainText('<div><strong>Conteúdo</div> restante');

      expect(resultado).toContain('Conteúdo');
      expect(resultado).toContain('restante');
      expect(resultado).not.toContain('<div>');
      expect(resultado).not.toContain('<strong>');
    });

    it('decodifica entidades HTML como texto', () => {
      const resultado = htmlToPlainText('<p>Node.js &amp; React &lt;3</p>');

      expect(resultado).toContain('Node.js & React <3');
    });

    it('retorna string vazia para conteúdo vazio', () => {
      expect(htmlToPlainText('')).toBe('');
    });
  });

  describe('safeExternalUrl', () => {
    it('aceita URL HTTPS', () => {
      expect(safeExternalUrl('https://example.com')).toBe('https://example.com/');
    });

    it('aceita URL HTTP', () => {
      expect(safeExternalUrl('http://example.com')).toBe('http://example.com/');
    });

    it('rejeita protocolo javascript', () => {
      expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejeita URL inválida', () => {
      expect(safeExternalUrl('não-é-uma-url')).toBeNull();
    });

    it('retorna null quando não há valor', () => {
      expect(safeExternalUrl(null)).toBeNull();
      expect(safeExternalUrl(undefined)).toBeNull();
      expect(safeExternalUrl('')).toBeNull();
    });
  });
});
