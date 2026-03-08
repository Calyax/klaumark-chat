import type { NextConfig } from 'next';
import path from 'path';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    // API-only service: no inline scripts, no external resources loaded server-side
    value: [
      "default-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
