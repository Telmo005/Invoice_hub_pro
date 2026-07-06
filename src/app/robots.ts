import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-hub-pro.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/invoices/',
          '/quotations/',
          '/receipts/',
          '/pages/',
          '/settings',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
