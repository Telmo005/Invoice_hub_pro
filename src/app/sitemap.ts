import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-hub-pro.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/politica-de-privacidade`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/termos-de-uso`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
