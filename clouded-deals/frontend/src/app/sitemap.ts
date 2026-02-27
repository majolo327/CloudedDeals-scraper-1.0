import type { MetadataRoute } from 'next';
import { DISPENSARIES } from '@/data/dispensaries';
import { BLOG_POSTS } from '@/data/blog-posts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

const CATEGORIES = ['flower', 'vapes', 'edibles', 'concentrates', 'prerolls'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/las-vegas-dispensary-deals`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/strip-dispensary-deals`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/strip`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/search`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/browse`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${SITE_URL}/deals/${cat}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Dispensary pages — only scraped dispensaries that have live deals
  const dispensaryPages: MetadataRoute.Sitemap = DISPENSARIES
    .filter((d) => d.scraped)
    .map((d) => ({
      url: `${SITE_URL}/dispensary/${d.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  // Zone landing pages
  const zonePages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/downtown-dispensary-deals`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/local-dispensary-deals`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
  ];

  // Blog pages
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  return [...staticPages, ...zonePages, ...categoryPages, ...dispensaryPages, ...blogPages];
}
