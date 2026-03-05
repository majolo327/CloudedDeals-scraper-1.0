import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { BLOG_POSTS } from '@/data/blog-posts';
import {
  BreadcrumbJsonLd,
  ArticleJsonLd,
  Breadcrumb,
  SeoPageHeader,
  SeoFooter,
} from '@/components/seo';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: post.metaTitle,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: `${SITE_URL}/blog/${post.slug}`,
    },
    openGraph: {
      title: post.metaTitle,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: 'CloudedDeals',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.metaTitle,
      description: post.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Category badge styles
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  guide: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  comparison: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  review: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.guide;
  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Structured data */}
      <BreadcrumbJsonLd
        items={[
          { name: 'Blog', href: '/blog' },
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />
      <ArticleJsonLd
        title={post.title}
        description={post.description}
        url={`${SITE_URL}/blog/${post.slug}`}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
      />

      <SeoPageHeader />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Blog', href: '/blog' },
            { name: post.title, href: `/blog/${post.slug}` },
          ]}
        />

        {/* Article header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${style.bg} ${style.text}`}>
              {post.category}
            </span>
            <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {post.readingTime}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            {post.title}
          </h1>

          <p className="text-slate-400 text-sm sm:text-base mb-4" data-speakable="true">
            {post.heroSubtitle}
          </p>

          <p className="text-xs text-slate-600 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </header>

        {/* Article body */}
        <article className="space-y-8 mb-12">
          {post.sections.map((section, si) => (
            <section key={si}>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">
                {section.heading}
              </h2>
              <div className="text-sm text-slate-400 leading-relaxed space-y-3">
                {section.content.map((paragraph, pi) => (
                  <p key={pi} {...(si === 0 && pi === 0 ? { 'data-speakable': 'true' } : {})}>
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.links && section.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors"
                    >
                      {link.text}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </article>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">More from the Blog</h2>
            <div className="grid gap-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="p-4 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-sm font-semibold text-slate-200 mb-1">{related.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{related.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Internal links */}
        <section className="pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              All Posts
            </Link>
            <Link
              href="/las-vegas-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              All Deals
            </Link>
            <Link
              href="/strip-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Strip Deals
            </Link>
            <Link
              href="/browse"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Browse Dispensaries
            </Link>
          </div>
        </section>
      </main>

      <SeoFooter />
    </div>
  );
}
