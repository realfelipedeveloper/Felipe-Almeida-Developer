const MEDIA_STORAGE_KEY = /^(?:image|pdf)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp|gif|pdf)$/;

export function assertMediaStorageKey(key: string): void {
  if (!MEDIA_STORAGE_KEY.test(key) || key.includes('\\') || key.includes('..')) {
    throw new Error('Chave de mídia inválida.');
  }
}
