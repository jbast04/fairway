/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['leaflet'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'server.arcgisonline.com',
      },
    ],
  },
}

export default nextConfig
