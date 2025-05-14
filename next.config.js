/** @type {import('next').NextConfig} */
const nextConfig = {
  // Linting işlemini devre dışı bırak
  eslint: {
    // Build sırasında linting hataları için derlemeyi durdurmaz
    ignoreDuringBuilds: true,
  },
  
  // TypeScript kontrollerini devre dışı bırak
  typescript: {
    // Build sırasında TypeScript hatalarını görmezden gel
    ignoreBuildErrors: true,
  },
  
  // Diğer yapılandırmalar...
  images: {
    domains: ['ton.org', 'example.com'],
  },
};

module.exports = nextConfig; 