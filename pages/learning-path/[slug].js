import React from 'react'
import LearnbyPath from '../../components/LearnbyPath'
import { findArticles } from '../../src/lib/db'
import SEO from '../../src/components/SEO'

const PATHS = ['beginner','intermediate','advanced']

export default function LearningPathSlug({ pathName, guides = [] }){
  return (
    <>
      <SEO title={`Learning Path: ${pathName.charAt(0).toUpperCase() + pathName.slice(1)}`} description={`Curated ${pathName} learning path: guides, tutorials, and resources to get started.`} canonical={`${process.env.SITE_URL || 'https://cointist.net'}/learning-path/${pathName}`} url={`/learning-path/${pathName}`} />
      <LearnbyPath guides={guides} hideHeader={false} pathName={pathName} />
    </>
  )
}

export async function getStaticPaths(){
  return { paths: PATHS.map(p => ({ params: { slug: p } })), fallback: false }
}

export async function getStaticProps({ params }){
  const slug = (params && params.slug) || 'beginner'
  try{
    const rows = await findArticles({ where: { category: 'Guides' }, take: 200, includeGuides: true });
    const guides = (rows || []).map(r => {
      const thumb = r.thumbnail || r.thumbnail_image || r.thumb || r.coverImage || r.cover_image || r.cover || r.ogImage || r.og_image || '';
      const title = r.title || r.slug || r.name || '';
      const date = r.publishedAt || r.published_at || r.date || null;
      return { id: r.id, title, thumb, date, slug: r.slug, level: (r.level || '').toString().toLowerCase(), subcategory: (r.subcategory || '').toString().toLowerCase(), tags: r.tags || [] };
    });
    // filter by slug (Beginner/Intermediate/Advanced). Use level or subcategory or tags heuristics
    const filtered = guides.filter(g => {
      const key = (g.subcategory || (g.tags && g.tags[0]) || g.level || '').toString().toLowerCase();
      return key.includes(slug) || (g.level && g.level.toLowerCase() === slug) || (g.title && g.title.toLowerCase().includes(slug));
    });
    return { props: { pathName: slug, guides: filtered.slice(0, 200) }, revalidate: 3600 }
  }catch(e){
    console.error('[pages/learning-path/[slug].js] getStaticProps error', e && e.message)
    return { props: { pathName: slug, guides: [] }, revalidate: 3600 }
  }
}
