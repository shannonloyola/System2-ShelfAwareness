/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, { dev }) => {
    if (dev && process.env.WATCHPACK_POLLING === 'true') {
      config.watchOptions = {
        poll: 1000, // Check for changes every second in Docker
        aggregateTimeout: 300, // Delay rebuild for batch changes
      };
    }
    return config;
  },
};

export default nextConfig;
