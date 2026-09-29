import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { getWebSecurityHeaders } from './src/lib/http-security';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
