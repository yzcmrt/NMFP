/** @type {import('next').NextConfig} */
const config = {
 reactStrictMode: true,
 poweredByHeader: false,
 images: { unoptimized: true },
 compiler: { removeConsole: { exclude: ['error','warn'] } },
 async headers() { return [{ source: '/:path*', headers: [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
 ] }]; }
};
export default config;
