import React from 'react';
import db from '../../src/lib/db';
import GuideLayout from '../../components/GuideLayout';
import SiteFooter from '../../src/components/SiteFooter';
import SEO from '../../src/components/SEO';

export async function getServerSideProps(context) {
  const { slug } = context.params || {};
  if (!slug) return { notFound: true };
  const art = await db.findArticleBySlug(slug);
  if (!art) return { notFound: true };
  // Ensure a descriptive excerpt exists for SEO: prefer stored excerpt/ogDescription, otherwise
  // generate a short plaintext excerpt from the article HTML content (best-effort).
  const article = JSON.parse(JSON.stringify(art));
  if (!article.excerpt && !article.ogDescription) {
    try{
      const raw = String(article.content || '');
      const plain = raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      if (plain.length) {
        article.excerpt = plain.length > 197 ? plain.slice(0,197).trim() + '...' : plain;
      } else {
        article.excerpt = '';
      }
    }catch(e){ article.excerpt = '' }
  }

  // Compute a cleaned meta description to avoid short generic excerpts
  // like "Track 3 - Applications" which cause duplicate meta descriptions.
  try {
    const rawContent = String(article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const contentSnippet = rawContent.slice(0, 150)
    const ex = String(article.excerpt || article.ogDescription || article.featuredDescription || '').trim()
    const isGenericTrack = /^Track\s*\d+/i.test(ex) || /^Track\s*-?/i.test(ex)
    if (article.ogDescription && String(article.ogDescription).length > 10) {
      article.metaDescription = String(article.ogDescription).trim()
    } else if (ex && !isGenericTrack && ex.length > 20) {
      article.metaDescription = ex
    } else if (article.featuredDescription && String(article.featuredDescription).length > 30) {
      article.metaDescription = String(article.featuredDescription).trim()
    } else if (contentSnippet && contentSnippet.length > 30) {
      article.metaDescription = contentSnippet
    } else {
      article.metaDescription = `${article.title || 'Cointist'} — Guides and explanations about crypto.`
    }
  } catch (e) {
    article.metaDescription = article.title ? `${article.title} • Cointist` : 'Cointist'
  }

  return { props: { article } };
}

export default function GuidePage({ article }) {
  if (!article) return <div>Not found</div>;
  return (
    <>
      <SEO
        title={article.ogTitle || article.title}
        description={article.metaDescription || article.ogDescription || article.excerpt}
        image={article.ogImage || article.coverImage}
        canonical={article.slug ? (process.env.SITE_URL || 'https://cointist.net') + `/guides/${encodeURIComponent(article.slug)}` : undefined}
        url={article.slug ? `/guides/${encodeURIComponent(article.slug)}` : undefined}
        schemaType="Article"
        author={article.author || article.authorName || article.author_name}
        datePublished={article.publishedAt || article.published_at || article.published || article.createdAt}
        dateModified={article.updatedAt || article.updated_at || article.modifiedAt || article.dateModified}
      />
      <GuideLayout article={article} />
      <SiteFooter />
    </>
  );
}
