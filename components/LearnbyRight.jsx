import React from 'react'

export default function LearnbyRight({ featured = null, trending = [] }){
  const f = featured || { title: 'Editor\'s pick: Getting started with RWAs', desc: 'How Real World Assets Become Tradable tokens', slug: '/guides/real-world-asset-tokenization-rwas', image: 'uploads/1756876188933-rwa.webp' }

  // fallback trending guides used when no `trending` prop is provided
  const defaultTrending = [
    { slug: '/guides/how-defi-protocols-work', title: 'DeFi Fundamentals', thumb: '/uploads/1756873318398-defivariant.webp' },
    { slug: '/guides/wallets-101-custodial-vs-non-custodial', title: 'Choosing a wallet', thumb: '/uploads/1756871398055-wallets.webp' },
    { slug: '/guides/stablecoins-payments', title: 'Stablecoins and Payments', thumb: '/uploads/1756870754193-stablecoins.webp' },
    { slug: '/guides/bridges-interopertability', title: 'Cross Chain Bridges', thumb: '/uploads/1756871925435-bridges.webp' },
    { slug: '/guides/nfts-overview', title: 'NFTs explained', thumb: '/assets/nfts.webp' }
  ]

  // Build a resized image URL using the project's image-resize API when the
  // source is a local path. Returns external URLs unchanged.
  function resizedImageUrl(src, w = 48, h = 48) {
    if (!src) return src
    try {
      const s = String(src).trim()
      if (s.startsWith('/')) return `/api/image-resize?path=${encodeURIComponent(s)}&w=${w}&h=${h}`
      return s
    } catch (e) { return src }
  }

  const trendingList = (trending && trending.length) ? trending : defaultTrending
  // ensure we always show at least 3 trending guides by filling from defaults
  const ensuredTrending = (() => {
    const base = Array.isArray(trendingList) ? trendingList.slice(0) : []
    if (base.length >= 3) return base
    for (let i = 0; i < defaultTrending.length && base.length < 3; i++){
      const item = defaultTrending[i]
      if (!base.find(b => b && b.slug === item.slug)) base.push(item)
    }
    return base
  })()

  return (
    <aside className="learnby-right" aria-label="Guides right column">
      <div className="featured">
        <img src={f.image} alt={f.title} />
  <h4>{f.title}</h4>
  <p>{f.desc || f.excerpt}</p>
        
      </div>

      <div className="trending">
        <h5>Trending Guides</h5>
        <ul>
          {ensuredTrending.slice(0,4).map(t => {
            const rawImg = t.cover || t.coverImage || t.ogImage || t.thumbnail || t.thumb || t.image || '/assets/markets.webp'
            const imgSrc = resizedImageUrl(rawImg, 48, 48)
            return (
              <li key={t.slug}><a href={t.slug}><img src={imgSrc} alt={t.title ? `${t.title} thumbnail` : 'Guide thumbnail'} />{t.title}</a></li>
            )
          })}
        </ul>
      </div>

      <style jsx>{`
  .learnby-right{ width:360px; box-sizing:border-box; margin-left:0; margin-right:28px; }
  .featured{ border-radius:12px; margin-top:28px;}
  .featured img{ width:100%; object-fit:cover; border-radius:8px; margin:0 0 12px 0;    margin-left: -5px; }
        .featured h4{ margin:8px 0 6px; font-size:16px; color: #e9f4ef; letter-spacing: -0.6px; }
        .featured p{ color: #9bb0ac; font-size:13px; margin:0; letter-spacing: -0.6px;}
        .cta{ display:inline-block; margin-top:10px; background:#14f195; color:#03281f; text-decoration:none; font-weight:600; padding:8px 12px; border-radius:8px; box-shadow: 0 6px 18px rgba(20,241,149,0.08) }
        .cta:hover{ transform: translateY(-1px); box-shadow: 0 10px 24px rgba(20,241,149,0.12) }
        .trending{ margin-top:52px; margin-left: 10px; }
        .trending h5{ margin:0 0 8px; color: #67f19aff; font-size:16px;  margin-bottom:18px; }
        .trending ul{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px }
        .trending li a{ display:flex; letter-spacing: -0.6px; gap:16px; align-items:center; color:#fff; text-decoration:none; margin-top:4px; }
        .trending img{ width:48px; height:48px; object-fit:cover; border-radius:6px; }
        @media (max-width:900px){
          .learnby-right{ width:100%; padding-left:12px; margin-left:0; }
          .featured img{ margin-top:0; margin-left:0 }
          .trending{ margin-left:0; padding-left:0 }
          .featured{ margin-top:12px; padding-left:0 }
        }
      `}</style>
    </aside>
  )
}
