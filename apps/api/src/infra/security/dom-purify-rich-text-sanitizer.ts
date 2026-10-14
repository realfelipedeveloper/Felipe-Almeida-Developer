import { Injectable } from '@nestjs/common';
import createDOMPurify, { type Config } from 'dompurify';
import { JSDOM } from 'jsdom';
import type { RichTextSanitizer } from '../../shared/application/rich-text-sanitizer';

const ALLOWED_TAGS = [
  'p',
  'br',
  'h2',
  'h3',
  'h4',
  'strong',
  'em',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'code',
  'a',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const;

const FORBIDDEN_TAGS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'xmp',
  'meta',
  'link',
  'base',
  'img',
  'video',
  'audio',
  'source',
] as const;

const CONFIG: Config = {
  ALLOWED_TAGS: [...ALLOWED_TAGS],
  ALLOWED_ATTR: ['href', 'title', 'scope'],
  FORBID_TAGS: [...FORBIDDEN_TAGS],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
};

function isAllowedHref(value: string): boolean {
  const href = value.trim();
  if (!href || href.startsWith('//') || /[\u0000-\u001f\u007f]/.test(href)) return false;
  if (
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('#') ||
    href.startsWith('?')
  ) {
    return true;
  }

  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href, 'https://local.invalid').protocol);
  } catch {
    return false;
  }
}

@Injectable()
export class DomPurifyRichTextSanitizer implements RichTextSanitizer {
  private readonly window = new JSDOM('').window;
  private readonly purifier = createDOMPurify(this.window);

  sanitize(value: string): string {
    const sanitized = this.purifier.sanitize(value, CONFIG);
    const container = this.window.document.createElement('div');
    container.innerHTML = sanitized;

    for (const anchor of container.querySelectorAll('a')) {
      const href = anchor.getAttribute('href');
      if (href && !isAllowedHref(href)) anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    }

    return container.innerHTML.trim();
  }

  hasMeaningfulContent(value: string): boolean {
    const container = this.window.document.createElement('div');
    container.innerHTML = value;
    return Boolean(container.textContent?.replace(/\u00a0/g, ' ').trim());
  }
}
