/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['shared'],
    experimental: {
      appDir: true,
    },
  }
  
  module.exports = nextConfig