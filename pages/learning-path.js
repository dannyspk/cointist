import React from 'react'
import LearnbyPath from '../components/LearnbyPath'
import { findArticles } from '../src/lib/db'

export default function LearningPathPage(props){
  return <LearnbyPath guides={props.guides || []} hideHeader={false} />
}

export async function getServerSideProps(context){
  // Server-side: fetch beginner guides for SEO and an immediate Browse All render.
  try{
    // Request up to 200 guides (server-side pagination can be added later)
    const rows = await findArticles({ where: { category: 'Guides' }, take: 200, includeGuides: true });
    // Map to a small shape safe for the client
    const guides = (rows || []).map(r => {
      // Normalize possible snake_case/camelCase fields coming from different DB sources
      const thumb = r.thumbnail || r.thumbnail_image || r.thumb || r.coverImage || r.cover_image || r.cover || r.ogImage || r.og_image || '';
      const title = r.title || r.slug || r.name || '';
      const date = r.publishedAt || r.published_at || r.date || null;
      return { id: r.id, title, thumb, date };
    });
    return { props: { guides } };
  }catch(e){
    console.error('[pages/learning-path] getServerSideProps error', e && e.message);
    return { props: { guides: [] } };
  }
}
