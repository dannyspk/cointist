import React, { useEffect } from 'react'
import Head from 'next/head'
import AUTHORS_META from '../src/data/authors'

// GuideLayout provides a reusable page shell for guide pages.
// It renders a hero area (crumbs, title, share/meta) and an author box
// and accepts props so individual guide pages can override content.
export default function GuideLayout({
  children,
  title,
  crumbs,
  heroImage,
  author,
  category,
  lastUpdated,
  // optional: accept an `article` object so callers can just pass the full
  // article fetched from the Admin UI / DB. We will use its fields as
  // fallbacks so both usages work.
  article
}){
  // If the article content (HTML string) contains an admin-generated TOC
  // (an <aside class="toc"> ... </aside>), extract it and render it into
  // the layout's right-column TOC. This ensures the TOC is positioned next
  // to the article headings instead of embedded inside the article body.
  let extractedToc = null;
  let articleBodyHtml = null;
  if (article && typeof article.content === 'string') {
    const contentRaw = article.content;
    const tocMatch = contentRaw.match(/<aside[^>]*class=["']toc["'][\s\S]*?<\/aside>/i);
    if (tocMatch) {
      extractedToc = tocMatch[0];
      articleBodyHtml = contentRaw.replace(tocMatch[0], '');
    } else {
      articleBodyHtml = contentRaw;
    }
    // remove any admin-rendered hero/crumbs/title blocks to avoid duplicating
    // the layout's own hero (excerpt + title). Strip the first <section class="hero">...
    // and any leading crumbs or top-level <h1> that may remain.
    try {
      articleBodyHtml = articleBodyHtml.replace(/<section[^>]*class=["']?hero["']?[^>]*>[\s\S]*?<\/section>/i, '');
      articleBodyHtml = articleBodyHtml.replace(/^\s*<div[^>]*class=["']?crumbs["']?[^>]*>[\s\S]*?<\/div>/i, '');
      articleBodyHtml = articleBodyHtml.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  // remove any leading plain-text (e.g. stray "GuidesStablecoins Explained")
  // that appears before the first HTML tag
  articleBodyHtml = articleBodyHtml.replace(/^[\s\S]*?(?=<[a-z!\/])/i, '');
    } catch (e) {
      // if regex fails for any reason, keep original body — non-fatal
    }
  }
  useEffect(()=>{
    let mod;
    // dynamically import client enhancements only on the client
    import('../lib/guide-client').then(m=>{ mod = m; try{ m.init && m.init(); }catch(e){} });
    return ()=>{ try{ mod && mod.destroy && mod.destroy(); }catch(e){} };
  }, []);

  return (
    <div className="guide-wrap guide-root">
      <style jsx>{`
        .learn-more .learn-inner .learn-card { position: relative; }
        .learn-more .learn-inner .learn-card h4 { margin: 12px 0 8px 0; position: relative; padding-bottom: 10px; }
        .learn-more .learn-inner .learn-card h4::after { content: ''; position: absolute; left: 0; right: 0; bottom: 2px; height: 3px; background: linear-gradient(90deg, rgba(20,241,149,0.9), rgba(20,241,149,0.6)); border-radius: 2px; opacity: 0.18; }
        .card-link-overlay { position: absolute; inset: 0; z-index: 4; display:block; }
      `}</style>
      <Head>
        <link rel="stylesheet" href="/styles/guides-layout.css" />
      </Head>

      {/* derive values from article when explicit props are not provided */}
      {(() => {
        const t = title || (article && article.title) || '';
        // excerpt from Admin UI should appear above the title and must not
        // include the category. Use article.excerpt when available and strip
        // a leading category token if present (e.g. "Guides: ...").
        const rawExcerpt = (article && (article.excerpt || article.description || article.summary)) || '';
        const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const excerpt = (() => {
          if (!rawExcerpt) return '';
          const catVal = (category || (article && article.category) || '').trim();
          if (!catVal) return rawExcerpt;
          try {
            const re = new RegExp('^\\s*' + escapeRegExp(catVal) + '[:\\-\\/\\|\\s]+', 'i');
            return rawExcerpt.replace(re, '').trim();
          } catch (e) {
            return rawExcerpt;
          }
        })();
  const c = crumbs || [];
        const hi = heroImage || (article && (article.heroImage || article.coverImage || article.ogImage || article.image));
        const cat = category || (article && article.category);
        const lu = lastUpdated || (article && (article.publishedAt || article.published_at || article.dateModified || article.dateModifiedAt || article.updatedAt || article.updated_at));
        const luStr = lu ? (() => { try { return new Date(lu).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(lu); } })() : null;
        // author: prefer explicit prop, then article fields; do NOT pull the
        // AUTHORS_META lead/byline for guide pages (we intentionally hide bylines)
        // Compute a safe author meta path: AUTHORS_META entries may already
        // include a leading '/' so avoid double-prefixing `/authors/orig/`.
        const authorMetaPath = (() => {
          try {
            const key = article && article.author
            const m = AUTHORS_META && key ? AUTHORS_META[key] : null
            if (!m || !m.file) return '/assets/author-avatar.webp'
            return String(m.file).startsWith('/') ? String(m.file) : `/authors/orig/${m.file}`
          } catch (e) {
            return '/assets/author-avatar.webp'
          }
        })();

        const auth = author || (article && (article.author ? {
          name: article.author,
          avatar: article.authorImage || article.authorAvatar || authorMetaPath
        } : null));

        return (
          <section className="hero">
            <div className="hero-inner">
              <div className="hero-left">
                
                {excerpt ? <div className="hero-excerpt">{excerpt}</div> : null}
                {t && <h1>{t}</h1>}
              </div>
              <div className="meta">
                <div className="share" aria-label="Share">
                  <div className="share-meta"></div>
                  <div className="share-icons">
                    <a href="#" title="Share on X" aria-label="Share on X">X</a>
                    <a href="#" title="Share on LinkedIn" aria-label="Share on LinkedIn">in</a>
                    <a href="#" title="Share on Reddit" aria-label="Share on Reddit">r</a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
  })()}

      {/* hero graphic / author box — use derived values when available */}
      {(() => {
        const hi = heroImage || (article && (article.heroImage || article.coverImage || article.ogImage || article.image));
        const lu = lastUpdated || (article && (article.publishedAt || article.published_at || article.dateModified || article.dateModifiedAt || article.updatedAt || article.updated_at));
        const luStr = lu ? (() => { try { return new Date(lu).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(lu); } })() : null;
        // compute excerpt to show under author box (prefer article.excerpt/description/summary)
        const rawExcerpt = (article && (article.excerpt || article.description || article.summary)) || '';
        const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const excerpt = (() => {
          if (!rawExcerpt) return '';
          const catVal = (category || (article && article.category) || '').trim();
          if (!catVal) return rawExcerpt;
          try {
            const re = new RegExp('^\\s*' + escapeRegExp(catVal) + '[:\\-\\/\\|\\s]+', 'i');
            return rawExcerpt.replace(re, '').trim();
          } catch (e) {
            return rawExcerpt;
          }
        })();
        // author: mirror the fallback logic used above so avatar is available
        // but do NOT include the lead/byline. Reuse the defensive authorMetaPath
        // to avoid double-prefixing when AUTHORS_META.file already includes '/'.
        const authorMetaPath = (() => {
          try {
            const key = article && article.author
            const m = AUTHORS_META && key ? AUTHORS_META[key] : null
            if (!m || !m.file) return '/assets/author-avatar.webp'
            return String(m.file).startsWith('/') ? String(m.file) : `/authors/orig/${m.file}`
          } catch (e) {
            return '/assets/author-avatar.webp'
          }
        })();

        const auth = author || (article && (article.author ? {
          name: article.author,
          avatar: article.authorImage || article.authorAvatar || authorMetaPath
        } : null));
        if (!(hi || auth)) return null;
        return (
          <div className="hero-graphic" aria-hidden="true">
            {hi && <img src={hi} alt="Illustration: cover" />}
            {auth && (
              <div className="author-box hero-author">
                {auth.avatar && <img src={auth.avatar} alt="Author avatar" className="author-avatar" />}
                <div className="author-meta">
                  {auth.name && <div className="author-name">{auth.name}</div>}
                  {excerpt && <div className="author-category">{excerpt}</div>}
                  {luStr && <div className="author-lastUpdated">Last updated: {luStr}</div>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <main className="wrap">
        <div className="grid">
          <div>
            <article>
              {/* Article content: prefer explicit children; fall back to cleaned article HTML when pages pass article only */}
              {children ? children : (article ? <div dangerouslySetInnerHTML={{ __html: articleBodyHtml || article.content || '' }} /> : null)}
            </article>

            {/* Related guides removed from layout — per-page components should render related links when needed */}
          </div>

          <aside className="toc" aria-label="On this page">
            {/* If an admin-provided TOC was embedded inside the article HTML, we extracted it
                earlier and removed it from the body; render its inner contents here. */}
            {extractedToc ? (
              <div dangerouslySetInnerHTML={{ __html: extractedToc.replace(/^<aside[^>]*>|<\/aside>$/gi, '') }} />
            ) : (
              <>
                <h4>On this page</h4>
                <ol />
              </>
            )}
          </aside>
        </div>
      </main>

      <section className="learn-more">
        <div className="learn-inner">
          <h3>Learn more about blockchain technology</h3>
          <div className="cards-viewport">
            <div className="cards-track" role="list">
              {(() => {
                // mapping of titles to category ids (fallback to slugified title)
                const map = {
                  'Asset Tokenization': 'tokenization',
                  'Markets': 'trading',
                  'Cross-Chain': 'scaling',
                  'DeFi': 'defi',
                  'L2s': 'scaling',
                  'Smart Contracts': 'eth'
                };
                const cards = [
                  { img: '/assets/guides/card-tokenization.webp', title: 'Asset Tokenization', desc: 'Learn how tokenization enables new digital ownership models and unlocks liquidity for real-world assets.' },
                  { img: '/assets/guides/Markets.webp', title: 'Markets', desc: 'Explore on-chain marketplaces, order books, and AMM mechanics that power decentralized trading.' },
                  { img: '/assets/guides/bridges.webp', title: 'Cross-Chain', desc: 'See how bridges, relayers, and interoperability layers connect otherwise isolated blockchains.' },
                  { img: '/assets/guides/DeFi.webp', title: 'DeFi', desc: 'Take a deep dive into decentralized finance primitives: lending, AMMs, staking, and yield strategies.' },
                  { img: '/assets/guides/layer2.webp', title: 'L2s', desc: 'Understand Layer 2 scaling: rollups, optimistic vs ZK approaches, and trade-offs for cost and security.' },
                  { img: '/assets/guides/smart-contract.webp', title: 'Smart Contracts', desc: 'Learn how programmable contracts automate rules, custody, and composable protocols on-chain.' }
                ];
                function slugify(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') }
                return cards.map(c => {
                  const id = map[c.title] || slugify(c.title);
                  const href = `/learn-by-category#${id}`;
                  return (
                    <article className="learn-card" role="listitem" key={c.title}>
                      <a className="card-link-overlay" href={href} aria-label={`Browse ${c.title} guides`} />
                      <div className="card-visual" aria-hidden>
                        <img src={c.img} alt={c.title + ' illustration'} />
                      </div>
                      <h4>{c.title}</h4>
                      <p>{c.desc}</p>
                    </article>
                  )
                })
              })()}

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/Markets.webp" alt="Market illustration" />
                </div>
                <h4>Markets</h4>
                <p>Explore on-chain marketplaces, order books, and AMM mechanics that power decentralized trading.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/bridges.webp" alt="Cross-chain illustration" />
                </div>
                <h4>Cross-Chain</h4>
                <p>See how bridges, relayers, and interoperability layers connect otherwise isolated blockchains.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/DeFi.webp" alt="DeFi illustration" />
                </div>
                <h4>DeFi</h4>
                <p>Take a deep dive into decentralized finance primitives: lending, AMMs, staking, and yield strategies.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/layer2.webp" alt="Layer 2 illustration" />
                </div>
                <h4>L2s</h4>
                <p>Understand Layer 2 scaling: rollups, optimistic vs ZK approaches, and trade-offs for cost and security.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/smart-contract.webp" alt="Smart contracts illustration" />
                </div>
                <h4>Smart Contracts</h4>
                <p>Learn how programmable contracts automate rules, custody, and composable protocols on-chain.</p>
              </article>
            </div>
          </div>
          <div className="cards-nav" aria-hidden>
            <button className="cards-prev" aria-label="Scroll left">◀</button>
            <button className="cards-next" aria-label="Scroll right">▶</button>
          </div>
        </div>
      </section>

  {/* learn-more section is intentionally static and remains part of the layout */}
    </div>
  )
}
