/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com'],
    unoptimized: true,
  },
  eslint: {
    // ESLint hatalarında derleme işlemini durdurmayalım
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
