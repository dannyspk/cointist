import React from 'react'
import LearnbyPath from '../../components/LearnbyPath'
import { findArticles } from '../../src/lib/db'
import SEO from '../../src/components/SEO'

export default function LearningPathPage(props){
  return (
    <>
      <SEO title={"Guides"} description={"Practical, beginner-friendly guides and deep dives on Bitcoin, Ethereum, DeFi, wallets, and on-chain analysis."} keywords={["guides","crypto","bitcoin","ethereum","defi"]} url={'/guides'} />
      <LearnbyPath guides={props.guides || []} serverPath={props.serverPath || null} hideHeader={false} />
    </>
  )
}

export async function getServerSideProps(context){
  // Server-side: fetch beginner guides for SEO and an immediate Browse All render.
  try{
    const rows = await findArticles({ where: { category: 'Guides' }, take: 200, includeGuides: true });
    let currentPath = null;
    if (context && context.query && context.query.path) currentPath = String(context.query.path || '').trim();
    const selectedLabel = currentPath ? (String(currentPath).charAt(0).toUpperCase() + String(currentPath).slice(1).toLowerCase()) : 'Beginner';

    function tagIncludes(raw, tagName) {
      if (!raw || !tagName) return false;
      const target = String(tagName).trim().toLowerCase();
      try {
        if (Array.isArray(raw)) return raw.map(t => String(t||'').trim().toLowerCase()).includes(target);
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
            try { const parsed = JSON.parse(trimmed); return tagIncludes(parsed, tagName); } catch(e) {}
          }
          return trimmed.split(',').map(t => t.trim().toLowerCase()).includes(target);
        }
        return String(raw).trim().toLowerCase() === target;
      } catch (e) { return false; }
    }

    const filteredRows = (rows || []).filter(r => {
      if (selectedLabel === 'Beginner') {
        if (tagIncludes(r.tags || r.tag || r.tags_list || r.labels || r.tagsString, 'Intermediate') || tagIncludes(r.tags || r.tag || r.tags_list || r.labels || r.tagsString, 'Advanced')) return false;
        return true;
      }
      if (selectedLabel === 'Intermediate') {
        return tagIncludes(r.tags || r.tag || r.tags_list || r.labels || r.tagsString, 'Intermediate');
      }
      if (selectedLabel === 'Advanced') {
        return tagIncludes(r.tags || r.tag || r.tags_list || r.labels || r.tagsString, 'Advanced');
      }
      return true;
    });

    const guides = filteredRows.map(r => {
      const thumb = r.thumbnail || r.thumbnail_image || r.thumb || r.coverImage || r.cover_image || r.cover || r.ogImage || r.og_image || '';
      const title = r.title || r.slug || r.name || '';
      const date = r.publishedAt || r.published_at || r.date || null;
      const slug = r.slug || r.slugified || r.name || '';
      const tags = r.tags || r.tags_list || r.tag || r.tagsString || r.labels || null;
      return { id: r.id, title, thumb, date, slug, tags };
    });
    return { props: { guides, serverPath: selectedLabel } };
  }catch(e){
    console.error('[pages/learning-path] getServerSideProps error', e && e.message);
    return { props: { guides: [] } };
  }
}
