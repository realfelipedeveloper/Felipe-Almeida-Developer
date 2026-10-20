import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { getWebSecurityHeaders } from './src/lib/http-security';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  // O standalone depende de symlinks que o Windows sem Developer Mode bloqueia.
  // CI e imagens Linux continuam produzindo o artefato mínimo de produção.
  output: process.platform === 'win32' ? undefined : 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: getWebSecurityHeaders(),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
