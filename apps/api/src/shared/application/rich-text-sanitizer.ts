export const RICH_TEXT_SANITIZER = Symbol('RICH_TEXT_SANITIZER');

export const MAX_RICH_TEXT_CHARACTERS = 200_000;

export interface RichTextSanitizer {
  sanitize(value: string): string;
  hasMeaningfulContent(value: string): boolean;
}
