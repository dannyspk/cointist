import React from 'react'

export default function ArticleList({ items = [] }){
  if(!items || items.length === 0) return (<div className="muted">No articles found.</div>);
  return (
    <div className="article-list">
      {items.map((it, idx) => (
        <article key={it.id || it.slug || idx} className="article-item">
          <h3 className="article-title">
            <a href={it.slug ? `/articles/${it.slug}` : it.href || '#'}>{it.title || it.slug || 'Untitled'}</a>
          </h3>
          {it.excerpt ? <p className="article-excerpt">{it.excerpt}</p> : null}
        </article>
      ))}
    </div>
  )
}
