/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable trailingSlash for cleaner URLs (optional, but fixes some 404s)
    trailingSlash: false,
    // Output: 'standalone' for better deploys (optional)
    output: 'standalone',
  }
  
  module.exports = nextConfig