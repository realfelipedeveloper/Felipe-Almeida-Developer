import { DomPurifyRichTextSanitizer } from './dom-purify-rich-text-sanitizer';

describe('DomPurifyRichTextSanitizer', () => {
  const sanitizer = new DomPurifyRichTextSanitizer();

  it('remove tags ativas, conteúdo raw-text, handlers e atributos não permitidos', () => {
    const unsafe = [
      '<p id="x" class="y" style="color:red" onclick="alert(1)">Texto seguro</p>',
      '<script>alert(1)</script><style>body{display:none}</style>',
      '<img src=x onerror="alert(1)">',
      '<svg onload="alert(1)"><a xlink:href="javascript:alert(1)">svg</a></svg>',
      '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>"></mtext></math>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<object data="data:text/html,x"></object><embed src="x">',
      '<form action="javascript:alert(1)"><input formaction="javascript:alert(1)"></form>',
      '<meta http-equiv="refresh" content="0;javascript:alert(1)"><base href="https://evil.test">',
      '<template><img src=x onerror=alert(1)></template><noscript><p>oculto</p></noscript>',
      '<xmp><img src=x onerror=alert(1)></xmp><textarea></textarea/> <img src=x onerror=alert(1)>',
    ].join('');

    const result = sanitizer.sanitize(unsafe);

    expect(result).toContain('<p>Texto seguro</p>');
    expect(result).not.toMatch(
      /script|style=|onclick|onerror|<img|<svg|<math|<iframe|srcdoc|<object|<embed|<form|<input|<meta|<base|<template|<noscript|<xmp|<textarea/i,
    );
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java&#x73;cript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'custom:payload',
    '//evil.example/path',
  ])('remove URL perigosa ou não permitida: %s', (href) => {
    const result = sanitizer.sanitize(`<a href="${href}">link</a>`);

    expect(result).toBe('<a rel="noopener noreferrer nofollow">link</a>');
  });

  it('preserva formatação editorial, tabela, UTF-8 e links explicitamente permitidos', () => {
    const input = [
      '<h2>Arquitetura</h2>',
      '<p>Use <strong>DDD</strong> e <code>TypeScript</code> — conteúdo em português.</p>',
      '<blockquote><em>Trade-offs importam.</em></blockquote>',
      '<ul><li>API</li><li>Worker</li></ul>',
      '<table><thead><tr><th scope="col">Idioma</th></tr></thead><tbody><tr><td>pt-BR</td></tr></tbody></table>',
      '<a href="https://example.com/docs" title="Documentação" target="_blank">HTTPS</a>',
      '<a href="mailto:contato@example.com">E-mail</a>',
      '<a href="/interno">Interno</a><a href="#secao">Âncora</a>',
    ].join('');

    const result = sanitizer.sanitize(input);

    expect(result).toContain('<h2>Arquitetura</h2>');
    expect(result).toContain(
      '<table><thead><tr><th scope="col">Idioma</th></tr></thead><tbody><tr><td>pt-BR</td></tr></tbody></table>',
    );
    expect(result).toContain(
      '<a href="https://example.com/docs" title="Documentação" rel="noopener noreferrer nofollow">HTTPS</a>',
    );
    expect(result).toContain(
      '<a href="mailto:contato@example.com" rel="noopener noreferrer nofollow">E-mail</a>',
    );
    expect(result).toContain('<a href="/interno" rel="noopener noreferrer nofollow">Interno</a>');
    expect(result).toContain('<a href="#secao" rel="noopener noreferrer nofollow">Âncora</a>');
    expect(result).not.toContain('target=');
  });

  it('detecta conteúdo sem significado após sanitização', () => {
    expect(sanitizer.hasMeaningfulContent('<p>&nbsp; </p>')).toBe(false);
    expect(sanitizer.hasMeaningfulContent('<p>Conteúdo</p>')).toBe(true);
  });

  it('é idempotente inclusive para payload hostil', () => {
    const input = '<p onload="x">Válido</p><svg><style><img src=x onerror=x></style></svg>';
    const sanitized = sanitizer.sanitize(input);

    expect(sanitizer.sanitize(sanitized)).toBe(sanitized);
  });
});
