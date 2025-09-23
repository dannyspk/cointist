import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import MarketMarquee from '../src/components/MarketMarquee'
import SiteFooter from '../src/components/SiteFooter'
import Learnby from '../components/Learnby';


// Utility: slugify a title as a safe fallback when the API omits slug fields.
function slugifyTitle(t) {
  if (!t) return '';
  return String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Helper: detect whether an article includes a given tag (robust to various DB shapes)
function hasTag(article, tagName) {
  if (!article || !tagName) return false;
  const raw = article.tags || article.tag || article.tags_list || article.tagList || article.tagsString || article.labels;
  if (!raw) return false;
  const target = String(tagName).trim().toLowerCase();
  let arr = [];
  if (Array.isArray(raw)) arr = raw.map(t => String(t || '').trim().toLowerCase());
  else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // support JSON-stringified arrays/objects
    if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
      try { const parsed = JSON.parse(trimmed); return hasTag({ tags: parsed }, tagName); } catch (e) {}
    }
    arr = trimmed.split(',').map(t => String(t || '').trim().toLowerCase());
  } else arr = [String(raw).trim().toLowerCase()];
  return arr.includes(target);
}

// Build a safe href for an article slug/value. Accepts full paths, prefixed values,
// plain slugs, and external URLs. Moved to module scope so other components can use it.
function buildHref(slug) {
  if (!slug) return '#';
  let s = String(slug).trim();
  s = s.replace(/^\s*["']+/, '').replace(/["']+\s*$/, '').trim();
  if (!s) return '#';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('guides/')) return `/${s}`;
  return `/guides/${s.split('/').map(seg => encodeURIComponent(seg)).join('/')}`;
}

export default function LearnbyPath({ guides = [], serverPath = null, hideHeader = false }){
  const router = useRouter();
  // keep server render stable: default to 'Beginner'
  const [selState, setSelState] = useState('Beginner');
  const [isNavigating, setIsNavigating] = useState(false);

  const heroCopy = {
    Beginner: {
      title: 'New to crypto? Begin with the essentials.',
      desc: 'Short, practical lessons on wallets, security, and core concepts to get you confident — quickly.',
      cta: 'Learn the basics'
    },
    Intermediate: {
      title: 'Ready to go deeper? Level up your skills.',
      desc: 'Hands-on guides covering trading, DeFi primitives, and practical workflows to build real competence.',
      cta: 'Advance your skills'
    },
    Advanced: {
      title: 'Build and innovate — advanced guides.',
      desc: 'Architectures, security best practices, and protocol internals for power users and builders.',
      cta: 'Explore advanced topics'
    }
  };
  const activeHero = heroCopy[selState] || heroCopy.Beginner;

  const crumbDisplay = selState || 'Beginner';

  useEffect(()=>{
    let mod;
    import('../lib/guide-client').then(m=>{ mod = m; try{ m.init && m.init(); }catch(e){} });

    // compute route selection on the client and update state to avoid hydration mismatch
    try{
      let currentPath = null;
      if (router && router.query && router.query.path) {
        currentPath = String(router.query.path || '').trim();
      } else if (router && router.asPath) {
        const m = router.asPath.match(/[?&]path=([^&]+)/i);
        if (m) currentPath = decodeURIComponent(m[1]);
        else {
          const seg = router.asPath.match(/(beginner|intermediate|advanced)/i);
          if (seg) currentPath = seg[1];
        }
      }
      const selectedLabel = currentPath ? (String(currentPath).charAt(0).toUpperCase() + String(currentPath).slice(1).toLowerCase()) : null;
      if (selectedLabel) setSelState(selectedLabel);
    }catch(e){}
  return ()=>{ try{ mod && mod.destroy && mod.destroy(); }catch(e){} };
  }, [router.asPath, router.query]);

  // On small screens, move the path-switcher from the right column to a
  // placeholder directly under the hero so "Get started" appears there.
  const mobilePathRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
  const mq = window.matchMedia && window.matchMedia('(max-width:1024px)');
  if (!mq || !mq.matches) return; // only run for small / tablet viewports
      const src = document.querySelector('.learnby-right .path-switcher');
      const dest = mobilePathRef.current;
      if (src && dest && !dest.contains(src)) {
        // remember where to restore later
        src.__origParent = src.parentNode;
        src.__nextSibling = src.nextSibling;
        dest.appendChild(src);
      }
      return () => {
        try {
          if (src && src.__origParent) {
            if (src.__nextSibling && src.__origParent.contains(src.__nextSibling)) {
              src.__origParent.insertBefore(src, src.__nextSibling);
            } else {
              src.__origParent.appendChild(src);
            }
            delete src.__origParent;
            delete src.__nextSibling;
          }
        } catch (e) {}
      };
    } catch (e) {}
  }, []);

  function handleSelect(e, p){
    if (e && e.preventDefault) e.preventDefault();
    // optimistic UI change
    setSelState(p);
  // small visual affordance: show a brief navigating indicator
  setIsNavigating(true);
  setTimeout(()=> setIsNavigating(false), 280);
  }

    const categories = [
    { key: 'bitcoin', title: 'Bitcoin', img: '/uploads/bitcoinguide.png', desc: 'Bitcoin fundamentals, wallets, and safety.' },
    { key: 'eth', title: 'Ethereum', img: '/uploads/ethereumguide.png', desc: 'Smart contracts and the Ethereum ecosystem.' },
    { key: 'regulation', title: 'Regulation', img: '/assets/regulation.png', desc: 'Overview of the global regulatory landscape for blockchain.' },
    { key: 'wallets', title: 'Wallets', img: '/uploads/wallets.png', desc: 'Custodial vs non-custodial and best practices.' },
    { key: 'defi', title: 'DeFi', img: '/uploads/defiguides.webp', desc: 'Decentralized finance protocols and use-cases.' },
    { key: 'trading', title: 'Trading', img: '/assets/markets.webp', desc: 'Trading basics, risk, and strategies.' },
    { key: 'scaling', title: 'Scaling', img: '/assets/scaling.webp', desc: 'Layer 2s, rollups, and performance.' },
    { key: 'nfts', title: 'NFTs', img: '/assets/nfts.webp', desc: 'Non-fungible tokens and creative economy.' }
  ]

  // mapping from local category keys to learn-by-category section ids (match homepage behavior)
  const idMap = {
    bitcoin: 'bitcoin',
    eth: 'ethereum',
    defi: 'defi',
    wallets: 'wallets',
    regulation: 'regulation',
    trading: 'trading',
    scaling: 'scaling',
    nfts: 'nfts'
  }

  // fallback static cards used if the API fetch fails
  const staticRightSmallCards = [
    { title: 'How do popular crypto wallets like MetaMask, Rainbow...', thumb: '/assets/guides/card-tokenization.webp', date: 'February 10, 2024' },
    { title: 'What is a seed phrase and how does it work?', thumb: '/assets/guides/seed-phrase.webp', date: 'March 4, 2024' }
  ];

  // client-side state for two live guide previews (loaded from the Guides DB)
  const [rightArticles, setRightArticles] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If the page passed server-rendered `guides` for this selState, reuse them
        // for the right small-cards so the client view matches the server Browse All.
        if (guides && guides.length && serverPath && serverPath === selState) {
          let filteredFromServer = guides.filter(g => {
            if (selState === 'Intermediate') return hasTag(g, 'Intermediate');
            if (selState === 'Advanced') return hasTag(g, 'Advanced');
            if (selState === 'Beginner') {
              if (hasTag(g, 'Intermediate') || hasTag(g, 'Advanced')) return false;
              return true;
            }
            return true;
          });
          // For Beginner, prefer the oldest guides (ascending by published/created date)
          if (selState === 'Beginner') {
            filteredFromServer = filteredFromServer.slice().sort((a,b) => {
              const da = new Date(a.publishedAt || a.published_at || a.date || a.createdAt || a.created_at || 0);
              const db = new Date(b.publishedAt || b.published_at || b.date || b.createdAt || b.created_at || 0);
              const ta = isNaN(da.getTime()) ? Infinity : da.getTime();
              const tb = isNaN(db.getTime()) ? Infinity : db.getTime();
              return ta - tb;
            });
          }

          filteredFromServer = filteredFromServer.slice(0,2).map(g => ({
            id: g.id,
            title: g.title || g.name || (g.slug ? g.slug.replace(/[-_]/g, ' ') : 'Untitled'),
            thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || '/assets/guides/card-tokenization.webp',
            date: g.publishedAt || g.published_at || g.date || '',
            slug: g.slug || g.slugified || g.name || slugifyTitle(g.title),
            tags: g.tags || g.tags_list || g.tag || g.tagsString || g.labels || null
          }));
          if (!cancelled && filteredFromServer && filteredFromServer.length) {
            setRightArticles(filteredFromServer);
            return;
          }
        }
  const q = new URLSearchParams({ category: 'Guides', includeGuides: '1', pageSize: '6', useSupabase: '1', featuredOnly: '0' });
        const res = await fetch(`/api/articles?${q.toString()}`);
        if (!res.ok) throw new Error('fetch failed');
        const payload = await res.json();
        const rows = Array.isArray(payload && payload.data) ? payload.data : [];
        // filter rows according to selState tag rules
  const filtered = rows.filter(g => {
          if (selState === 'Intermediate') return hasTag(g, 'Intermediate');
          if (selState === 'Advanced') return hasTag(g, 'Advanced');
          // Beginner: exclude Intermediate and Advanced
          if (selState === 'Beginner') {
            if (hasTag(g, 'Intermediate') || hasTag(g, 'Advanced')) return false;
            return true;
          }
          return true;
        });
        // debug: trace filtering results (short lists of titles)
        try {
          const safeTitles = (arr) => (Array.isArray(arr) ? arr.slice(0,6).map(x => x && (x.title || x.name || x.slug || x.id) ) : []);
          console.debug('[LearnbyPath:rightCards] selState=', selState, 'rows=', rows.length, 'filteredCount=', filtered.length, 'filteredTitles=', safeTitles(filtered));
        } catch(e) {}
        // For Beginner path prefer the oldest beginner guides (ascending by date).
        const ordered = (selState === 'Beginner') ? filtered.slice().sort((a,b) => {
          const dateA = new Date(a.publishedAt || a.published_at || a.date || a.createdAt || a.created_at || 0);
          const dateB = new Date(b.publishedAt || b.published_at || b.date || b.createdAt || b.created_at || 0);
          const ta = isNaN(dateA.getTime()) ? Infinity : dateA.getTime();
          const tb = isNaN(dateB.getTime()) ? Infinity : dateB.getTime();
          return ta - tb;
        }) : filtered;

        let mapped = ordered.slice(0,2).map((g) => ({
          id: g.id,
          title: g.title || g.name || (g.slug ? g.slug.replace(/[-_]/g, ' ') : 'Untitled'),
          thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || '/assets/guides/card-tokenization.webp',
          date: g.publishedAt || g.published_at || g.date || '',
          slug: g.slug || g.slugified || g.name || slugifyTitle(g.title),
          tags: g.tags || g.tags_list || g.tag || g.tagsString || g.labels || null
        }));
        // If tag filtering produced no candidates but the API returned rows,
        // prefer DB rows that satisfy the Beginner rules (i.e. do NOT include
        // 'Intermediate' or 'Advanced' tags). If none match, fall back to the
        // first available rows so the UI isn't empty.
          if ((!mapped || mapped.length === 0) && rows && rows.length > 0) {
          let beginnerCandidates = rows.filter(r => {
            // exclude any row tagged Intermediate or Advanced
            if (hasTag(r, 'Intermediate') || hasTag(r, 'Advanced')) return false;
            return true;
          });
          try { console.debug('[LearnbyPath:rightCards] beginnerCandidatesCount=', beginnerCandidates.length, 'beginnerTitles=', (beginnerCandidates||[]).slice(0,6).map(x => x && (x.title || x.name || x.slug || x.id))); } catch(e) {}
          if (beginnerCandidates && beginnerCandidates.length) {
            // sort beginner candidates by oldest first
            beginnerCandidates = beginnerCandidates.slice().sort((a,b) => {
              const da = new Date(a.publishedAt || a.published_at || a.date || a.createdAt || a.created_at || 0);
              const db = new Date(b.publishedAt || b.published_at || b.date || b.createdAt || b.created_at || 0);
              const tA = isNaN(da.getTime()) ? Infinity : da.getTime();
              const tB = isNaN(db.getTime()) ? Infinity : db.getTime();
              return tA - tB;
            });
            mapped = beginnerCandidates.slice(0,2).map((g) => ({
              id: g.id,
              title: g.title || g.name || (g.slug ? g.slug.replace(/[-_]/g, ' ') : 'Untitled'),
              thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || '/assets/guides/card-tokenization.webp',
              date: g.publishedAt || g.published_at || g.date || '',
              slug: g.slug || g.slugified || g.name || slugifyTitle(g.title),
              tags: g.tags || g.tags_list || g.tag || g.tagsString || g.labels || null
            }));
          } else {
            // no beginner candidates found — keep mapped empty so UI will use static placeholders
            mapped = [];
          }
        }
        if (!cancelled) setRightArticles(mapped);
      } catch (e) {
        console.debug('[LearnbyPath] failed loading right articles', e && e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [selState]);

  // Articles list for the "Browse All" section.
  // Use `guides` prop if provided by the page; otherwise fetch client-side when the
  // selected path changes. We keep a small placeholder while loading.
  const articlesPerPage = 6;
  const [fetchedArticles, setFetchedArticles] = useState((guides && guides.length) ? (
    guides
      .filter(g => {
          if (selState === 'Intermediate') return hasTag(g, 'Intermediate');
          if (selState === 'Advanced') return hasTag(g, 'Advanced');
          if (selState === 'Beginner') {
            if (hasTag(g, 'Intermediate') || hasTag(g, 'Advanced')) return false;
            return true;
          }
          return true;
        })
      .map((g, idx) => ({
        id: g.id || idx,
        title: g.title || (g.slug ? g.slug.replace(/[-_]/g, ' ') : `Guide ${idx+1}`),
        slug: g.slug || g.slugified || g.name || slugifyTitle(g.title) || '',
        // preserve tags from server so client-side filtering works without extra fetch
        tags: g.tags || g.tags_list || g.tag || g.tagsString || g.labels || null,
        // accept multiple possible image fields coming from Supabase or Prisma
        cover: g.cover || g.coverImage || g.cover_image || g.ogImage || g.og_image || g.thumbnail || g.thumbnail_image || g.thumb || (idx % 3 === 0 ? '/assets/guides/card-tokenization.webp' : idx % 3 === 1 ? '/assets/web3.webp' : '/assets/markets.webp'),
        thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || g.ogImage || g.og_image || (idx % 3 === 0 ? '/assets/guides/card-tokenization.webp' : idx % 3 === 1 ? '/assets/web3.webp' : '/assets/markets.webp'),
        date: g.date || g.publishedAt || g.published_at || 'September 1, 2024'
      }))
  ) : []);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const totalPages = Math.max(1, Math.ceil((fetchedArticles && fetchedArticles.length ? fetchedArticles.length : 0) / articlesPerPage));
  const [currentPage, setCurrentPage] = React.useState(1);
  const displayedArticles = (fetchedArticles && fetchedArticles.length) ? fetchedArticles.slice((currentPage - 1) * articlesPerPage, currentPage * articlesPerPage) : [];

  function formatDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return String(d); }
  }

  // Build a safe href for an article slug/value. Accepts:
  // - full paths ("/guides/what-is-web3")
  // - already-prefixed values ("guides/what-is-web3")
  // - plain slugs ("what-is-web3")
  // - external URLs ("https://...")
  

  // Slugify a title as a safe fallback when the API omits slug fields.
  

  // When selState changes and no server-provided `guides` were passed, fetch the guides for that path
  useEffect(() => {
    // reset to page 1 for every new selection
    setCurrentPage(1);
  // if guides were passed in via props and the serverPath matches the current selState, use them and skip client fetch
  if (guides && guides.length && serverPath && serverPath === selState) {
      const filtered = guides.filter(g => {
        if (selState === 'Intermediate') return hasTag(g, 'Intermediate');
        if (selState === 'Advanced') return hasTag(g, 'Advanced');
        if (selState === 'Beginner') {
          if (hasTag(g, 'Intermediate') || hasTag(g, 'Advanced')) return false;
          return true;
        }
        return true;
      });
      setFetchedArticles(filtered.map((g, idx) => ({
        id: g.id || idx,
        title: g.title || g.slug || `Guide ${idx+1}`,
        slug: g.slug || g.slugified || g.name || slugifyTitle(g.title) || '',
  tags: g.tags || g.tags_list || g.tag || g.tagsString || g.labels || null,
        cover: g.cover || g.coverImage || g.cover_image || g.ogImage || g.og_image || g.thumbnail || g.thumbnail_image || g.thumb || '/assets/guides/card-tokenization.webp',
        thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || '/assets/guides/card-tokenization.webp',
        date: g.date || ''
      })));
      return;
    }

    let cancelled = false;
    async function loadGuides() {
      setIsLoadingArticles(true);
      try {
        // Use the articles API which supports including Guides via includeGuides
        // and can filter by a path query param if you choose to support it server-side.
  const q = new URLSearchParams({ category: 'Guides', includeGuides: '1', pageSize: '200', useSupabase: '1', featuredOnly: '0' });
        // Optionally include path as a query so backend can filter if supported
        if (selState) q.set('path', selState);
        const fetchUrl = `/api/articles?${q.toString()}`;
        async function doFetch(url) {
          const r = await fetch(url, { credentials: 'same-origin' });
          console.debug('[LearnbyPath] fetch', url, 'status=', r.status, 'ok=', r.ok);
          if (!r.ok) {
            const bodyText = await r.text().catch(()=>null);
            console.debug('[LearnbyPath] fetch not ok, body=', bodyText);
            return null;
          }
          try { return await r.json(); } catch (e) { const bt = await r.text().catch(()=>null); console.debug('[LearnbyPath] failed to parse JSON, text=', bt); return null; }
        }

        let payload = await doFetch(fetchUrl);

        // If payload looks empty or contains items without slugs, try common alternate dev ports (3002,3000)
        const looksEmpty = !(payload && Array.isArray(payload.data) && payload.data.length > 0);
        const noSlugs = !looksEmpty && payload.data.every(it => !(it && (it.slug || it.slugified || it.name || it.title)));
        if (looksEmpty || noSlugs) {
          const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
          const altPorts = [3002, 3000];
          for (let p of altPorts) {
            try {
              const altUrl = `${window.location.protocol}//${host}:${p}/api/articles?${q.toString()}`;
              const altPayload = await doFetch(altUrl);
              if (altPayload && Array.isArray(altPayload.data) && altPayload.data.length > 0) {
                // prefer payloads that include at least one slug-like field
                const hasSlug = altPayload.data.some(it => it && (it.slug || it.slugified || it.name || it.title));
                if (hasSlug) {
                  console.debug('[LearnbyPath] using alternate origin', altUrl);
                  payload = altPayload;
                  break;
                }
              }
            } catch (e) { console.debug('[LearnbyPath] alt fetch failed', p, e && e.message); }
          }
        }

        console.debug('[LearnbyPath] payload keys=', payload && Object.keys(payload).slice(0,10), 'dataLength=', Array.isArray(payload && payload.data) ? payload.data.length : undefined);
  const rows = Array.isArray(payload && payload.data) ? payload.data : (payload || []);
        const filteredRows = rows.filter(g => {
          if (selState === 'Intermediate') return hasTag(g, 'Intermediate');
          if (selState === 'Advanced') return hasTag(g, 'Advanced');
          if (selState === 'Beginner') {
            if (hasTag(g, 'Intermediate') || hasTag(g, 'Advanced')) return false;
            return true;
          }
          return true;
        });
  const mapped = filteredRows.map((g, idx) => ({
          id: g.id || idx,
          slug: g.slug || g.slugified || g.name || '',
          title: g.title || g.slug || g.name || `Guide ${idx+1}`,
          cover: g.cover || g.coverImage || g.cover_image || g.ogImage || g.og_image || g.thumbnail || g.thumbnail_image || g.thumb || '/assets/guides/card-tokenization.webp',
          thumb: g.thumbnail || g.thumbnail_image || g.thumb || g.cover || g.coverImage || g.cover_image || g.ogImage || g.og_image || '/assets/guides/card-tokenization.webp',
          date: g.publishedAt || g.published_at || g.date || ''
        }));
        if (!cancelled) setFetchedArticles(mapped);
      } catch (e) {
        // on error, leave placeholders empty (UI will show nothing) — keep console for debug
        console.debug('[LearnbyPath] failed loading guides', e && e.message);
        if (!cancelled && (!fetchedArticles || fetchedArticles.length === 0)) {
          // fallback small placeholder set so the UI isn't empty (explicit empty slug)
          setFetchedArticles(Array.from({ length: 6 }).map((_, i) => ({ id: i, slug: '', title: `Guide ${i+1}`, thumb: i % 3 === 0 ? '/assets/guides/card-tokenization.webp' : i % 3 === 1 ? '/assets/web3.webp' : '/assets/markets.webp', date: '' })));
        }
      } finally {
        if (!cancelled) setIsLoadingArticles(false);
      }
    }

    loadGuides();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selState]);

  function handlePageChange(p){
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    // optional: scroll to the browse-all section on page change
    try{ const el = document.querySelector('.browse-all'); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }catch(e){}
  }

  return (
    <>
      { !hideHeader && (
        <Head>
          <link rel="stylesheet" href="/styles/guides-layout.min.css" />
          <link rel="stylesheet" href="/styles/learnby-path.min.css" />
        </Head>
      ) }

      <style jsx>{`
        .learn-card{ position: relative; }
        .card-link-overlay{ position: absolute; inset: 0; z-index: 6; display: block; text-indent: -9999px; }
      `}</style>

      <div className="learnbypath-market-marquee">
        <MarketMarquee />
      </div>

      <div className="container">
        
        <div className="learnby-grid">
          <div className="learnby-main">
            <div className="learnby-top">
              <div className="learnbypath-breadcrumb page-title">
                <h1>
                  <span className="site-name">Cointist</span>
                  <span className="divide">|</span>
                  <span className="page-section">Guides</span>
                  <span className="chevron">›</span>
                  <span className="subject">{crumbDisplay}</span>
                </h1>
                {isNavigating && <span className="crumb-loading" aria-hidden />}
              </div>

              <div className="learnby-hero" role="region" aria-label={`${selState} guide intro`}>
              <div className="hero-left">
                <h3>{activeHero.title}</h3>
                <p>{activeHero.desc}</p>
                <a className="hero-cta" href={`/guides?path=${encodeURIComponent(selState)}`}>{activeHero.cta}</a>
              </div>
              <div className="hero-right" aria-hidden>
                <div className="hero-image">
                  <img src="/assets/learnbyhero.svg" alt="Beginner guide illustration" loading="lazy" />
                </div>
              </div>
              </div>
              {/* Mobile placeholder: script will move the .path-switcher here on narrow viewports */}
              <div ref={mobilePathRef} className="mobile-path-placeholder" aria-hidden />
            </div>

            <div className="learnby-body">

              <p className="learnby-intro">START HERE</p>

              <section className="start-here">
                  <div className="learn-inner">
                  <div>
                    <FeaturedGuidePlaceholder selState={selState} />
                  </div>

                  <div aria-hidden />
                </div>
              </section>

              <section className="browse-all">
                <div className="learn-inner">
                  <h2 className="section-title">BROWSE ALL</h2>
                  <div className="article-cards">
                    {displayedArticles.map((item, i) => {
                      const content = (
                        <>
                          <div className={`article-thumb ${i % 3 === 0 ? 'article-thumb--a' : i % 3 === 1 ? 'article-thumb--b' : 'article-thumb--c'}`}>
                            {/* prefer server-provided cover image, fall back to thumb */}
                            { (item.cover || item.thumb) ? (
                              <img src={item.cover || item.thumb} alt={item.title ? `${item.title} thumbnail` : 'Guide thumbnail'} loading="lazy" />
                            ) : null}
                          </div>
                          <h4 className="article-title">{item.title}</h4>
                          <div className="article-meta">
                            <span className="badge">{selState || (item && item.tags ? (Array.isArray(item.tags) ? item.tags[0] : String(item.tags).split(',')[0]) : 'Beginner')}</span>
                            <small className="meta-date">{formatDate(item.date)}</small>
                          </div>
                        </>
                      );

                      const href = buildHref(item && item.slug ? item.slug : '');
                      const isReal = href && href !== '#';
                      // Dev-only debug: log computed hrefs so we can inspect why anchors may be missing.
                      try { if (process && process.env && process.env.NODE_ENV !== 'production') console.debug('[LearnbyPath] card', i, 'slug=', item && item.slug, 'href=', href, 'isReal=', isReal); } catch(e){}
                      return (
                        // expose slug/href as data attributes for quick DOM inspection in the browser
                        <article key={item.id || i} className="article-card" data-slug={item && item.slug ? String(item.slug) : ''} data-href={href}>
                          { isReal ? (
                            <Link href={href} legacyBehavior>
                              <a className="article-card-link" style={{display:'block', color:'inherit', textDecoration:'none'}}>{content}</a>
                            </Link>
                          ) : (
                            <div className="article-card-link article-card-placeholder" aria-disabled style={{display:'block'}}>{content}</div>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  { totalPages > 1 && (
                    <div className="article-pagination" aria-label="Article pages">
                      <button className="page-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
                      
                      {Array.from({ length: totalPages }).map((_, pIdx) => (
                        <button key={pIdx} className={`page-btn ${currentPage === (pIdx+1) ? 'active' : ''}`} onClick={() => handlePageChange(pIdx+1)}>{pIdx+1}</button>
                      )) }
                      <button className="page-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
                    </div>
                  )}
                </div>
              </section>

              <section className="learn-more">
                <div className="learn-inner">
                  <h2>Learn by Category</h2>
                  <div className="cards-viewport">
                    <div className="cards-track" role="list">
                      {categories.map(cat => {
                        const id = (idMap && idMap[cat.key]) || cat.key;
                        const imgSrc = (cat.img && String(cat.img).startsWith('/')) ? (cat.img.indexOf('/uploads') !== -1 ? `/api/image-resize?path=${encodeURIComponent(cat.img)}` : cat.img) : cat.img;
                        return (
                          <article className="learn-card" role="listitem" key={cat.key}>
                            <a className="card-link-overlay" href={`/learn-by-category#${id}`} aria-label={`Browse ${cat.title} guides`} />
                            <div className="card-visual" aria-hidden>
                              <img src={imgSrc} alt={cat.title + ' image'} />
                            </div>
                            <div className="card-caption">
                              <h4>{cat.title}</h4>
                              <p>{cat.desc}</p>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                  <div className="cards-nav" aria-hidden>
                    <button className="cards-prev" aria-label="Scroll left">◀</button>
                    <button className="cards-next" aria-label="Scroll right">▶</button>
                  </div>
                </div>
              </section>

            </div>{/* .learnby-body */}

          </div>{/* .learnby-main */}

          <div className="learnby-right">
            <aside className="path-switcher" aria-label="Choose learning path">
              <h4>Get started</h4>
              <nav>
                {['Beginner','Intermediate','Advanced'].map((p) => (
                  <a key={p} href={`?path=${encodeURIComponent(p)}`} onClick={(e)=>handleSelect(e,p)} className={`path-option ${selState===p? 'path-option--active':''}`}>
                    <span className="path-dot" aria-hidden />
                    <span className="path-label">{p}</span>
                  </a>
                ))}
              </nav>
            </aside>

            <div className="right-cards" aria-hidden>
              { ((rightArticles && rightArticles.length) ? rightArticles : ((fetchedArticles && fetchedArticles.length) ? (
                  (selState === 'Beginner') ? (
                    // pick the oldest two fetchedArticles for Beginner
                    fetchedArticles.slice().sort((a,b) => {
                      const da = new Date(a.date || a.publishedAt || a.published_at || 0);
                      const db = new Date(b.date || b.publishedAt || b.published_at || 0);
                      const ta = isNaN(da.getTime()) ? Infinity : da.getTime();
                      const tb = isNaN(db.getTime()) ? Infinity : db.getTime();
                      return ta - tb;
                    }).slice(0,2)
                  ) : fetchedArticles.slice(0,2)
                ) : staticRightSmallCards)).map((c,i) => {
                const isLive = !!(rightArticles && rightArticles.length) || (!!fetchedArticles && fetchedArticles.length);
                const href = isLive ? buildHref(c.slug || '') : '#';
                // Top row: thumbnail + title (aligned vertically center)
                // Bottom row: badge + date (anchored to card bottom)
                const topRow = (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div
                      className={`small-card-thumb`}
                      aria-hidden
                      style={{
                        backgroundImage: `url(${c.thumb})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        flex: '0 0 72px',
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)'
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <h5 className="small-card-title" style={{ margin: 0, fontSize: 15, lineHeight: '1.2' }}>{c.title}</h5>
                    </div>
                  </div>
                );

                const bottomRow = (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <span className="badge" style={{ fontSize: 12, padding: '6px 8px' }}>{selState || (c && c.tags ? (Array.isArray(c.tags) ? c.tags[0] : String(c.tags).split(',')[0]) : 'Beginner')}</span>
                    <small className="meta-date" style={{ color: 'var(--muted)' }}>{formatDate(c.date)}</small>
                  </div>
                );

                return (
                  <article key={c.id || i} className="small-card" style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', background: 'rgba(15,20,25,0.6)', border: '1px solid rgba(30,38,48,0.9)', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
                    { isLive && href && href !== '#' ? (
                      <Link href={href} legacyBehavior>
                        <a style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none', padding: 12, minHeight: 96 }}>{topRow}{bottomRow}</a>
                      </Link>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12, minHeight: 96 }}>{topRow}{bottomRow}</div>
                    ) }
                  </article>
                );
              })}
            </div>
          </div>

        </div>{/* .learnby-grid */}
      </div>{/* .container */}
      
    <SiteFooter />
    </>
  )
}

// Client-only component: fetch a published guide page and extract simple metadata
function FeaturedGuidePlaceholder({ selState }){
  // If the selected path is Beginner, always show a static featured placeholder
  // (do not run the dynamic fetch). Other paths keep the existing dynamic behavior.
  if (selState === 'Beginner') {
    const href = '/guides/blockchain-basics';
    const featuredContent = (
      <>
        <div className="featured-thumb" aria-hidden>
          <img src={'/assets/guides/blockchain-basics-cover.webp'} alt={'Blockchain Basics cover'} loading="eager" />
        </div>
        <h3 className="featured-title">Blockchain Basics</h3>
        <p className="fdesc">A friendly introduction to blockchains: transactions, consensus, and what decentralization really means for users.</p>
        <div className="featured-meta">
          <span className="badge">Beginner</span>
          <small className="meta-date">Updated recently</small>
        </div>
      </>
    );

    return (
      <article className="featured-article">
        <Link href={href} legacyBehavior>
          <a style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{featuredContent}</a>
        </Link>
      </article>
    );
  }

  // --- Existing dynamic behavior for Intermediate / Advanced ---
  const [data, setData] = useState(null);
  useEffect(()=>{
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async ()=>{
      try{
  const q = new URLSearchParams({ category: 'Guides', includeGuides: '1', pageSize: '8', useSupabase: '1', featuredOnly: '0' });
        const res = await fetch(`/api/articles?${q.toString()}`);
        console.debug('[FeaturedGuidePlaceholder] fetch url=', `/api/articles?${q.toString()}`, 'status=', res.status);
        if (!res.ok) return;
        const payload = await res.json();
        const rows = Array.isArray(payload && payload.data) ? payload.data : [];
        console.debug('[FeaturedGuidePlaceholder] rows length=', rows.length);
        // pick a candidate matching the selState rules; fallback to first available
        let candidate = rows.find(r => {
          if (selState === 'Intermediate') return hasTag(r, 'Intermediate');
          if (selState === 'Advanced') return hasTag(r, 'Advanced');
          return true;
        });
        if (!candidate && rows.length) candidate = rows[0];
        if (!candidate) return;
        const title = candidate.title || candidate.name || (candidate.slug ? candidate.slug.replace(/[-_]/g,' ') : 'Featured Guide');
        const img = candidate.thumbnail || candidate.thumbnail_image || candidate.cover || candidate.coverImage || '/assets/guides/featured-hardware.webp';
  // Prefer an explicit featured description from the DB if available
  const desc = candidate.featuredDescription || candidate.featured_description || candidate.featured_desc || candidate.description || candidate.excerpt || candidate.lead || '';
        if (!cancelled) setData({ title, img, desc, slug: candidate.slug || candidate.slugified || slugifyTitle(title), tags: candidate.tags || candidate.tags_list || candidate.tag || candidate.tagsString || candidate.labels || null });
      }catch(e){ console.debug('[FeaturedGuidePlaceholder] fetch failed', e && e.message); }
    })();
    return ()=>{ cancelled = true; };
  }, [selState]);

  if (!data) {
    return (
      <article className="featured-article">
        <div className="featured-thumb" aria-hidden />
        <h3 className="featured-title">Loading featured guide…</h3>
        <p className="fdesc"> </p>
      </article>
    );
  }

  const href = data && data.slug ? buildHref(data.slug) : '#';
  const featuredContent = (
    <>
      <div className="featured-thumb" aria-hidden>
        <img src={data.img} alt={data.title + ' cover'} loading="eager" />
      </div>
      <h3 className="featured-title">{data.title}</h3>
      <p className="fdesc">{data.desc}</p>
      <div className="featured-meta">
        <span className="badge">{selState || 'Beginner'}</span>
        <small className="meta-date">Updated recently</small>
      </div>
    </>
  );

  return (
    <article className="featured-article">
      { href && href !== '#' ? (
        <Link href={href} legacyBehavior><a style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{featuredContent}</a></Link>
      ) : featuredContent }
    </article>
  );
}



