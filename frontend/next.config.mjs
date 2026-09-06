/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: [
    '192.168.1.20',
    '192.168.1.20:3000',
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
    '[::1]',
    '[::1]:3000',
  ],
};

export default nextConfig;
