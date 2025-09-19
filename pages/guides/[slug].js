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

  return { props: { article } };
}

export default function GuidePage({ article }) {
  if (!article) return <div>Not found</div>;
  return (
    <>
      <SEO
        title={article.ogTitle || article.title}
        description={article.ogDescription || article.excerpt}
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
