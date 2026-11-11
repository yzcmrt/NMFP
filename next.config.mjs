/** @type {import('next').NextConfig} */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://*.t.me;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://toncenter.com https://*.toncenter.com https://ton.access.orbs.network https://*.ton.access.orbs.network https://api.telegram.org https://raw.githubusercontent.com;
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  compiler: { removeConsole: { exclude: ['error', 'warn'] } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          { key: 'Content-Security-Policy', value: cspHeader },
        ],
      },
    ];
  },
};

export default config;
