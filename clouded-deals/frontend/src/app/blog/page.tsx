import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import { BLOG_POSTS } from '@/data/blog-posts';
import {
  BreadcrumbJsonLd,
  Breadcrumb,
  SeoPageHeader,
  SeoFooter,
} from '@/components/seo';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

export const metadata: Metadata = {
  title: 'Las Vegas Cannabis Blog — Dispensary Guides & Deal Tips',
  description:
    'Guides, comparisons, and tips for finding the best cannabis deals in Las Vegas. Updated regularly.',
  keywords: [
    'las vegas dispensary blog',
    'vegas weed guide',
    'dispensary tips las vegas',
    'vegas cannabis guide 2026',
  ],
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: 'Las Vegas Cannabis Blog | CloudedDeals',
    description:
      'Guides, comparisons, and tips for finding the best cannabis deals in Las Vegas.',
    url: `${SITE_URL}/blog`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Las Vegas Cannabis Blog | CloudedDeals',
    description:
      'Guides, comparisons, and tips for finding the best cannabis deals in Las Vegas.',
  },
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  guide: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  comparison: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  review: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      <BreadcrumbJsonLd items={[{ name: 'Blog', href: '/blog' }]} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb items={[{ name: 'Blog', href: '/blog' }]} />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Las Vegas Cannabis Blog
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
            Guides, comparisons, and tips for finding the best dispensary deals in
            Las Vegas. Written by the team that checks every dispensary every morning.
          </p>
        </div>

        {/* Post cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {BLOG_POSTS.map((post) => {
            const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.guide;
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="p-5 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors group"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${style.bg} ${style.text}`}>
                    {post.category}
                  </span>
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {post.readingTime}
                  </span>
                </div>

                <h2 className="text-base font-semibold text-slate-200 mb-2 group-hover:text-purple-400 transition-colors">
                  {post.title}
                </h2>

                <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2">
                  {post.description}
                </p>

                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </Link>
            );
          })}
        </div>

        {/* SEO copy */}
        <section className="mb-10 max-w-3xl">
          <div className="text-sm text-slate-400 leading-relaxed space-y-3">
            <p>
              The CloudedDeals blog covers everything you need to know about
              cannabis shopping in Las Vegas — from Strip dispensary guides to
              price comparisons and deal-finding tips. Every article is backed by
              real daily pricing data from 27+ licensed dispensaries.
            </p>
          </div>
        </section>

        {/* Internal links */}
        <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-semibold mb-4">Explore Deals</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/las-vegas-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              All Las Vegas Deals
            </Link>
            <Link
              href="/strip-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Strip Deals
            </Link>
            {['flower', 'vapes', 'edibles', 'concentrates', 'prerolls'].map((cat) => (
              <Link
                key={cat}
                href={`/deals/${cat}`}
                className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)} Deals
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SeoFooter />
    </div>
  );
}
