/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Disable Fast Refresh to prevent rapid reloads
  webpack: (config, { dev, isServer }) => {
    // Socket.io-client SSR da crash bo'lmasligi uchun
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('socket.io-client');
    }
    // Docker ichida hot reload - disabled for stability
    if (dev) {
      config.watchOptions = {
        poll: 3000, // Increase poll interval
        aggregateTimeout: 500,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  // Disable automatic static optimization for auth pages
  experimental: {
    optimizeCss: false,
  },
};

module.exports = nextConfig;
