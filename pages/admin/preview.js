import React from 'react';
import prisma from '../../src/lib/prisma';
import db from '../../src/lib/db';
import SEO from '../../src/components/SEO'

export async function getServerSideProps({ query }) {
  const { id, slug } = query;
  let art = null;
  if (id) art = await db.findArticleById(id);
  else if (slug) art = await db.findArticleBySlug(slug);
  if (!art) return { notFound: true };
  return { props: { article: JSON.parse(JSON.stringify(art)) } };
}

export default function Preview({ article }) {
  const base = process.env.SITE_URL || 'https://cointist.net';
  return (
    <html>
      <head>
        {/* Use SEO meta for preview rendering where possible */}
        <title>{(article.ogTitle || article.title) + ' | Cointist'}</title>
        <meta name="description" content={article.ogDescription || article.excerpt || ''} />
        <meta property="og:title" content={(article.ogTitle || article.title) + ' | Cointist'} />
        <meta property="og:description" content={article.ogDescription || article.excerpt || ''} />
        <meta property="og:image" content={article.ogImage || (article.coverImage ? `${base}${article.coverImage}` : '')} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={(article.ogTitle || article.title) + ' | Cointist'} />
        <meta name="twitter:description" content={article.ogDescription || article.excerpt || ''} />
      </head>
      <body>
        <article style={{ maxWidth:800, margin:'40px auto', fontFamily:'Inter, system-ui, Arial' }}>
          <h1>{article.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </article>
      </body>
    </html>
  );
}
