export function validateWorkerSecurityConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const privacySecret = process.env.PRIVACY_REQUEST_TOKEN_SECRET?.trim();
  if (!privacySecret || privacySecret.length < 32 || privacySecret.startsWith('gere-')) {
    throw new Error('PRIVACY_REQUEST_TOKEN_SECRET precisa ter pelo menos 32 caracteres.');
  }

  const privacyHashSecret = process.env.PRIVACY_HASH_SECRET?.trim();
  if (
    !privacyHashSecret ||
    privacyHashSecret.length < 32 ||
    privacyHashSecret.startsWith('gere-')
  ) {
    throw new Error('PRIVACY_HASH_SECRET precisa ter pelo menos 32 caracteres.');
  }

  let webUrl: URL;
  try {
    webUrl = new URL(process.env.WEB_URL ?? '');
  } catch {
    throw new Error('WEB_URL precisa ser uma URL HTTPS válida em produção.');
  }
  if (webUrl.protocol !== 'https:') {
    throw new Error('WEB_URL precisa utilizar HTTPS em produção.');
  }

  if (process.env.METRICS_ENABLED !== 'false') {
    const metricsToken = process.env.METRICS_TOKEN?.trim();
    if (!metricsToken || metricsToken.length < 32 || metricsToken.startsWith('gere-')) {
      throw new Error('METRICS_TOKEN precisa ter pelo menos 32 caracteres em produção.');
    }
  }
}
