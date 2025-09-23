import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import SEO from '../src/components/SEO';
import Image from 'next/image'
import EditorsPickList from '../src/components/EditorsPickList';
import LatestNews from '../src/components/LatestNews';
import { findArticles } from '../src/lib/db'
// Topbar is rendered globally in _app.js
import dynamic from 'next/dynamic'
// Lazy-load heavy, interactive widgets to reduce initial JS payload and improve Lighthouse scores
const MarketMarquee = dynamic(() => import('../src/components/MarketMarquee'), {
  ssr: false,
  loading: () => <div aria-hidden className="marquee-placeholder" />
})
const SectorIndices = dynamic(() => import('../src/components/SectorIndices'), {
  ssr: false,
  loading: () => <div aria-hidden className="sector-placeholder" />
})
import SiteFooter from '../src/components/SiteFooter';
import Learnby from '../components/Learnby';
import SubscribeModal from '../src/components/SubscribeModal';
import AnalysisSection from '../components/AnalysisSection';

// server-side fetch to ensure DB items are available on initial render
export async function getServerSideProps(context){
  try{
    const { findArticles } = require('../src/lib/db')
    const fs = require('fs')
    const path = require('path')

    // load press items and opinions from DB, prefer recent
  const rawPress = await findArticles({ where: { category: 'News', pinned: false, featuredOnly: false, published: true }, sort: 'recent', take: 30 })
    const pressList = Array.isArray(rawPress) ? rawPress : (rawPress || [])
    // filter for 'latest' subcategory first
    let filtered = pressList.filter(it => it && it.subcategory && String(it.subcategory).toLowerCase() === 'latest')
    if (filtered.length < 4) {
      const map = new Map()
      filtered.forEach(it=>{ const key = it.id || it.slug || it.title; if (key) map.set(key, it) })
      for (const it of pressList){
        if (filtered.length >= 4) break
        const key = it && (it.id || it.slug || it.title)
        if (!key) continue
        if (map.has(key)) continue
        map.set(key, it)
        filtered.push(it)
      }
    }
    // Ensure any Date objects are serialized to strings so Next can JSON-serialize props
    function serializeArticle(it){
      if (!it) return null
      const out = { ...it }
      const dateFields = ['publishedAt','published_at','createdAt','created_at','updatedAt','updated_at']
      for (const f of dateFields){
        if (out[f] instanceof Date) out[f] = out[f].toISOString()
        else if (out[f] !== undefined && out[f] !== null) out[f] = String(out[f])
        else out[f] = null
      }
      return out
    }

    // Ensure server-side press items are in chronological order (newest first)
    const pickDate = (it) => {
      if (!it) return 0
      const raw = it.createdAt || it.created_at || null
      const d = raw ? (new Date(raw)).getTime() : 0
      return isNaN(d) ? 0 : d
    }
    filtered.sort((a,b) => pickDate(b) - pickDate(a))
    const pressItems = filtered.slice(0,4).map(serializeArticle)
  const rawOpinions = await findArticles({ where: { category: 'Opinions', published: true }, sort: 'recent', take: 6 })
    const opinions = Array.isArray(rawOpinions) ? rawOpinions : (rawOpinions || [])
    const opinionItems = opinions.filter(it => it && (it.published === true || String(it.published) === 'true')).slice(0,4).map(serializeArticle)

    // build staticPages list (previously in getStaticProps) so UI keeps same data shape
    const pagesDir = path.join(process.cwd(), 'public', 'pages')
    const pages = []
    if (fs.existsSync(pagesDir)){
      function walk(dir, base=''){
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries){
          if (e.isDirectory()) { walk(path.join(dir, e.name), path.posix.join(base, e.name)); continue }
          if (!e.name.toLowerCase().endsWith('.html')) continue
          const rel = path.posix.join(base, e.name)
          let href = '/' + rel.replace(/\.html$/i, '')
          href = href.replace(/\\/g, '/')
          if (href.endsWith('/index')) href = href.replace(/\/index$/,'')
          if (href === '') href = '/'
          if (href !== '/') pages.push({ href, title: e.name.replace(/\.html$/i, '') })
        }
      }
      walk(pagesDir, '')
    }

    return { props: { serverPressItems: pressItems, serverOpinionItems: opinionItems, staticPages: pages } }
  }catch(e){
    return { props: { serverPressItems: null, serverOpinionItems: null, staticPages: [] } }
  }
}

export default function Home({ staticPages = [], serverPressItems = null, serverOpinionItems = null }) {
  const [pressItems, setPressItems] = React.useState(serverPressItems === null ? null : serverPressItems)
  const [opinionItems, setOpinionItems] = React.useState(serverOpinionItems === null ? null : serverOpinionItems)
  // Subscribe confirmation modal state (client-only)
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false)
  const [subscribeModalEmail, setSubscribeModalEmail] = useState('')

  // Expose a small client-side API so the inline DOM-mounted script can show the modal
  React.useEffect(()=>{
    if (typeof window === 'undefined') return
    window.showSubscribeModal = function(email){
      try{ setSubscribeModalEmail(String(email || '').trim()) }catch(e){ setSubscribeModalEmail('') }
      setSubscribeModalOpen(true)
    }
    return ()=>{ try{ delete window.showSubscribeModal }catch(e){} }
  }, [])

  React.useEffect(()=>{
    let mounted = true
    async function loadOpinions(){
  // if server provided opinions (non-empty), skip client fetch; otherwise attempt client fetch
      if (Array.isArray(serverOpinionItems) && serverOpinionItems.length > 0) {
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] skipping client opinions fetch; serverOpinionItems:', serverOpinionItems)
        return
      }
      try{
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] client opinions fetch starting; serverOpinionItems:', serverOpinionItems)
        const qs = new URLSearchParams({ category: 'Opinions', page: '1', pageSize: '4' })
        const res = await fetch('/api/articles?' + qs.toString())
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
  const list = Array.isArray(json.data) ? json.data : (json.data || [])
  // Defensive: ensure we only keep published articles for the public homepage
  const publishedOnlyList = list.filter(it => it && (it.published === true || String(it.published) === 'true'))
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] client opinions fetched', list)
        if (!mounted) return
        // Only show published opinions client-side (defensive: server may still return drafts)
        const publishedOnly = list.filter(it => it && (it.published === true || String(it.published) === 'true'))
        // Deduplicate by slug (preferred) or title to avoid showing the same article multiple times
        const seen = new Set()
        const deduped = []
        for (const it of publishedOnly) {
          if (!it) continue
          const key = it.slug || it.title || String(it.id || '')
          if (!key) continue
          if (seen.has(key)) continue
          seen.add(key)
          deduped.push(it)
          if (deduped.length >= 4) break
        }
        setOpinionItems(deduped.slice(0,4))
  if (process.env.NODE_ENV !== 'production') console.debug('[Home] opinionItems set', deduped.slice(0,4))
      }catch(e){ if (!mounted) return; setOpinionItems([]) }
    }
    loadOpinions()
    return ()=>{ mounted = false }
  }, [])

  // Ensure a valid src for next/image: pick a single URL from possible
  // srcset-like strings, return an absolute URL or a path starting with '/'.
  const normalizeSrc = (s) => {
    if (!s) return s
    try{
      let raw = String(s).trim()
      // If someone accidentally passed a full srcset (comma-separated), take first candidate
      if (raw.indexOf(',') !== -1) raw = raw.split(',')[0]
      // If candidate contains a descriptor (" 1x" or " 400w"), take the URL part
      raw = raw.split(/\s+/)[0]
      // strip surrounding quotes
      raw = raw.replace(/^['"]|['"]$/g, '')
      if (/^https?:\/\//i.test(raw)) return raw
      return raw.startsWith('/') ? raw : `/${raw}`
    }catch(e){ return s }
  }

  function safeFilename(title){
    if (!title) return '';
    return String(title).toLowerCase().replace(/[^a-z0-9\s-_.]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/(^-|-$)/g,'');
  }

  // Helper: pick the most relevant date for ordering (client-side)
    const pickDate = (it) => {
      if (!it) return 0
      // prefer creation time as the primary ordering key
      const raw = it.createdAt || it.created_at || it.publishedAt || it.published_at || it.updatedAt || it.updated_at || null
      const d = raw ? (new Date(raw)).getTime() : 0
      return isNaN(d) ? 0 : d
    }

  React.useEffect(()=>{
    let mounted = true
    async function load(){
  // if server provided press items (non-empty), skip client fetch; otherwise attempt client fetch
      if (Array.isArray(serverPressItems) && serverPressItems.length > 0) {
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] skipping client press fetch; serverPressItems:', serverPressItems)
        return
      }
      try{
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] client press fetch starting; serverPressItems:', serverPressItems)
        // fetch non-pinned news and filter client-side for subcategory 'latest' (case-insensitive)
  const qs = new URLSearchParams({ category: 'News', pinned: 'false', featuredOnly: '0', page: '1', pageSize: '20', sort: 'recent' })
        const res = await fetch('/api/articles?' + qs.toString())
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        const list = Array.isArray(json.data) ? json.data : (json.data || [])
        if (process.env.NODE_ENV !== 'production') console.debug('[Home] client press fetched', list.slice(0,8))
  // sort by creation time (createdAt) descending, falling back to publishedAt
  publishedOnlyList.sort((a,b)=>{
    const Araw = a && (a.createdAt || a.created_at || a.publishedAt || a.published_at) ? new Date(a.createdAt || a.created_at || a.publishedAt || a.published_at).getTime() : 0
    const Braw = b && (b.createdAt || b.created_at || b.publishedAt || b.published_at) ? new Date(b.createdAt || b.created_at || b.publishedAt || b.published_at).getTime() : 0
    return Braw - Araw
  })
  let filtered = publishedOnlyList.filter(it => it && it.subcategory && String(it.subcategory).toLowerCase() === 'latest')
        // If fewer than 4 results, fetch a broader list (un-pinned) and merge unique items until we have at least 4
        if (filtered.length < 4) {
          try{
            const qs2 = new URLSearchParams({ category: 'News', page: '1', pageSize: '30', pinned: 'false', featuredOnly: '0' })
            const res2 = await fetch('/api/articles?' + qs2.toString())
            if (res2.ok){
              const json2 = await res2.json()
              const more = Array.isArray(json2.data) ? json2.data : (json2.data || [])
              const map = new Map()
              // seed with existing filtered
              filtered.forEach(it=>{
                const key = it.id || it.slug || it.title
                if (key) map.set(key, it)
              })
              for (const it of more){
                if (filtered.length >= 4) break
                if (!it) continue
                const key = it.id || it.slug || it.title
                if (!key) continue
                if (map.has(key)) continue
                // avoid current article if present
                try{
                  if (article && ((article.id && it.id && String(it.id) === String(article.id)) || (article.slug && it.slug && String(it.slug) === String(article.slug)))) continue
                }catch(e){}
                map.set(key, it)
                filtered.push(it)
              }
            }
          }catch(e){ /* ignore */ }
        }
        if (!mounted) return
        // enforce maximum of 4 unpinned press items
            setPressItems(filtered.slice(0,4))
  if (process.env.NODE_ENV !== 'production') console.debug('[Home] pressItems set', filtered.slice(0,4))
      }catch(e){
        if (!mounted) return
        setPressItems([])
      }
    }
    load()
    return ()=>{ mounted = false }
  }, [])

// server-side fetch to ensure DB items are available on initial render

  return (
    <>
  <SEO url={'/'} description="Cointist publishes timely crypto news, Bitcoin and Ethereum analysis, and data-driven market reports to help investors and builders." image="/assets/logo.webp" primaryKeyword="crypto" keywords={["crypto","bitcoin","ethereum","markets"]} />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
  {/* banner preload removed; next/image with priority handles LCP efficiently */}
  {/* styles are imported in _app.js; remove duplicate static links */}
      </Head>
  {/* Topbar is rendered globally in _app.js */}

  {/* Mobile: center all headings inside the main homepage grid */}
  {/* Mobile heading centering moved to central stylesheet */}

  {/* Header and mobile menu are rendered globally in _app.js */}

  {/* Market Marquee (canonical) */}
  <MarketMarquee data-primary="true" />

  {/* Homepage visible H1 removed per request; title preserved in SEO */}

      {/* Ad Banner */}
      <div className="ad-banner">
        {/* Use next/image to serve optimized responsive images */}
  <Image src="/assets/gpt.png" alt="Advertisement" width={1200} height={120} priority={true} fetchPriority="high" />
      </div>

      {/* Main Page Grid */}
      <section className="mainpage-grid">
        <aside className="mainpage-left">
          <h2 className="latest-heading">Latest <span style={{ color: '#ffd600' }}>News</span></h2>
          <div className="press-list">
        {Array.isArray(pressItems) && pressItems.length ? (
          // ensure we show press items newest-first regardless of source ordering
          [...pressItems].filter(it => String((it && it.category) || '').toLowerCase() !== 'opinions').sort((a,b)=> pickDate(b) - pickDate(a)).map((it)=>{
                // Use the DB 'thumbnail' field for press-item thumbnails.
                // Do NOT fall back to coverImage here — cover photos should not be used as thumbnails.
                const img = it.thumbnail || '/assets/press1.webp'
                const title = it.title || 'Untitled'
                // support both camelCase and snake_case date fields returned by different APIs
                // Prefer creation time (`createdAt`) for displayed metadata and fall back to published/updated
                let date = ''
                try{
                  const raw = it && (it.createdAt || it.created_at || it.publishedAt || it.published_at || it.updatedAt || it.updated_at)
                  if (raw) {
                    const d = new Date(raw)
                    if (!isNaN(d)) date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  }
                }catch(e){ date = '' }
                const href = it.slug ? `/articles/${it.slug}` : '#'
                return (
                  <div className="press-item" key={it.id || it.slug || title}>
                    <a href={href} aria-label={"Read: " + title} style={{display: 'inline-block', width: 120, height: 80}}>
                      <Image src={normalizeSrc(img)} alt={title} width={120} height={80} />
                    </a>
                    <div>
                      <div>{title}</div>
                      <a href={href} aria-label={`Read more about ${title}`}>Read more</a>
                      <div className="press-date">{date}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              // show lightweight placeholders while DB is loading; render nothing if DB returned empty array
              pressItems === null ? (
                <>
                  {[0,1,2,3].map(i=> (
                    <div className="press-item placeholder" key={i}>
                      <div style={{width:120,height:80,background:'#0b0d0e',borderRadius:6}} />
                      <div>
                        <div style={{height:14,width:160,background:'#111',marginBottom:8,borderRadius:4}} />
                        <div style={{height:12,width:60,background:'#0e0e0e',marginBottom:6,borderRadius:3}} />
                        <div style={{fontSize:13,opacity:0.7}}>—</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : null
            )}
          </div>
        </aside>
        <main className="mainpage-center">
          <h2 className="featured-heading">Featured <span style={{ color: '#ffd600' }}>News</span></h2>
          <FeaturedCarousel />
        </main>
        <aside className="mainpage-right">
          <h2 className="opinions-heading">Opinions</h2>
          <div className="opinion-list">
            {Array.isArray(opinionItems) && opinionItems.length ? (
              opinionItems.map((it)=>{
                const title = it.title || 'Untitled'
                const author = it.author || 'Cointist'
                const href = it.slug ? `/articles/${it.slug}` : '#'
                const thumb = it.thumbnail || it.coverImage || '/assets/press1.webp'
                return (
                  <div className="opinion-item" key={it.id || it.slug || title}>
                    <div>
                      <div className="opinion-title"><a href={href}>{title}</a></div>
                      <div style={{ marginTop:6 }}><a href={href} style={{ color: '#ffd600', textDecoration: 'none', fontWeight:700 }}>Read opinion</a></div>
                      <div style={{ marginTop:6, fontSize:13, opacity:0.9 }}>by {author}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              opinionItems === null ? (
                <>
                  {[0,1,2,3].map(i=> (
                    <div className="opinion-item" key={i} aria-hidden>
                      <div>
                        <div style={{height:16,width:220,background:'#0b0d0e',marginBottom:6,borderRadius:4}} />
                        <div style={{height:12,width:80,background:'#0e0e0e',marginBottom:6,borderRadius:3}} />
                        <div style={{fontSize:13,opacity:0.8}}>by —</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : null
            )}
          </div>
        </aside>
      </section>

      {/* Newsletter Section */}
      <section className="subscribe-band" id="subscribe">
        <div className="subscribe-inner">
          <h2 className="subscribe-title">Next Alpha Drop</h2>
          <p className="subscribe-sub">Early coins, airdrops & data-driven signals — straight to your inbox. Curated by Cointist.</p>
          {/* Controlled subscribe form that posts to /api/subscribe */}
          <form
            id="subscribe-form"
            onSubmit={async (e) => {
              e.preventDefault();
            }}
            noValidate
          >
            {/* The real submit handler is mounted via DOM after render to avoid changing too many lines above */}
            <input id="subscribe-email" type="email" name="email" placeholder="Email address" aria-label="Email address" required />
            <button class="subscribe-btn" type="submit">Subscribe</button>
            <div id="subscribe-msg" role="status" aria-live="polite" style={{ marginTop: 8 }} />
          </form>

          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              const form = document.getElementById('subscribe-form');
              if (!form) return;
              const input = document.getElementById('subscribe-email');
              const submit = document.getElementById('subscribe-submit');
              const msg = document.getElementById('subscribe-msg');
              let loading = false;
              function setMessage(t, isError){ msg.textContent = String(t || ''); msg.style.color = isError ? '#090909ff' : '#0c0d0cff'; }

              // Remove invisible/zero-width characters that sometimes get pasted
              function cleanEmail(s){
                if (!s) return s;
                try{ s = String(s).trim(); }catch(e){ s = String(s || '') }
                // Unicode normalize, strip invisible controls
                try{ s = s.normalize ? s.normalize('NFKC') : s; }catch(e){}
                s = s.replace(/[\u200B-\u200F\uFEFF\u2060-\u206F\u00A0]/g, '');
                return s;
              }

              form.addEventListener('submit', async function(ev){
                ev.preventDefault();
                if (loading) return;
                const raw = input && input.value ? input.value : '';
                const email = cleanEmail(raw);
                console.debug('[subscribe] raw:', JSON.stringify(raw), 'clean:', JSON.stringify(email));
                if (!email) { setMessage('Please enter your email', true); input.focus(); return; }

                // More permissive but practical email regex (doesn't try to match every RFC edge case)
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
                const ok = re.test(email);
                console.debug('[subscribe] regex test:', ok);
                if (!ok) { setMessage('Please enter a valid email address', true); input.focus(); return; }

                loading = true; submit.disabled = true; submit.textContent = 'Sending…'; setMessage('');
                try{
                  const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                  const json = await res.json().catch(()=>null);
                  if (!res.ok) {
                    const err = (json && json.error) ? json.error : 'Subscription failed';
                    setMessage(err, true);
                  } else {
                    setMessage('Thanks — check your inbox for a confirmation!', false);
                    // Clear the input and show the branded modal if available
                    try{ input.value = ''; }catch(e){}
                    try{ if (window && typeof window.showSubscribeModal === 'function') window.showSubscribeModal(email); }catch(e){}
                  }
                }catch(e){ console.error('[subscribe] network error', e); setMessage('Network error — please try again', true); }
                loading = false; submit.disabled = false; submit.textContent = 'Subscribe';
              });
            })();
          ` }} />

          <SubscribeModal open={subscribeModalOpen} email={subscribeModalEmail} onClose={()=>setSubscribeModalOpen(false)} />
        </div>
      </section>

      {/* News List & Sector Indices */}
      <section className="container main">
        <div>
          <div className="news-list">
              <h4 style={{fontWeight: 900, margin:'8px 0', letterSpacing: '-1px', padding: '0 12px', fontSize: '32px', fontFamily: 'var(--font-head)'}}>Trending News</h4>

            {/* Editors' Pick (pinned=true) dynamic content */}
            <EditorsPickList excludeIds={Array.isArray(pressItems) ? pressItems.map(p=>p.id).filter(Boolean) : []} />
          </div>
        </div>
        <SectorIndices />
      </section>

    {/* Sponsored Section */}
  {/* Learn-by (Guides) — placed above Sponsored section */}

  <AnalysisSection />

  <section className="container sponsored-block">
    <div className="sponsored-inner">

<h2 style={{margin:'8px 0', color: '#0b0d0e', letterSpacing: '-2px', padding: '0 8px', fontSize: '50px', fontFamily: 'var(--font-head)'}}>Sponsored</h2>
            <div className="sponsored-grid">
            <div className="sponsored-item-card">
            <Image src="/assets/sponsored1.webp" alt="Sponsored 1" className="sponsored-thumb" width={300} height={170} />
            <div className="sponsored-content">
              <h4 className="sponsored-title">Boost Treasury Yield — Earn Reliable On‑Chain Rewards</h4>
              <p className="sponsored-desc">Convert idle assets into steady yield with a non‑custodial liquidity solution designed for treasuries and DAOs. Easy integration, predictable returns.</p>
            </div>
          </div>
          <div className="sponsored-item-card">
            <Image src="/assets/sponsored2.webp" alt="Sponsored 2" className="sponsored-thumb" width={300} height={170} />
            <div className="sponsored-content">
              <h4 className="sponsored-title">Enterprise Oracles — High Fidelity Price Feeds</h4>
              <p className="sponsored-desc">Protect your contracts with redundant, low‑latency oracle feeds built for production DeFi. SLA‑backed reliability and simple integration for teams.</p>
            </div>
          </div>
          <div className="sponsored-item-card">
            <Image src="/assets/automate-bot.webp" alt="Sponsored 3" className="sponsored-thumb" width={300} height={170} />
            <div className="sponsored-content sponsored-center">
              <h4 className="sponsored-title">Automated Execution — Trading Bots That Work 24/7</h4>
              <p className="sponsored-desc">Launch AI‑driven execution tailored to your risk profile. Continuous monitoring, adaptive strategies, and a hands‑off setup to capture market opportunities.</p>
            </div>
          </div>
          <div className="sponsored-item-card">
            <Image src="/assets/cashback.webp" alt="Sponsored 4" className="sponsored-thumb" width={300} height={170} />
            <div className="sponsored-content sponsored-center">
              <h4 className="sponsored-title">Institutional Custody & Compliance, Simplified</h4>
              <p className="sponsored-desc">Enterprise custody with insurance, audit tooling, and compliance workflows to meet regulatory requirements—built for funds and regulated entities.</p>
            </div>
          </div>
            </div>
        </div>
        <div className="sponsored-more">
          <a href="#" className="view-more">View more <span className="view-more-arrow">→</span></a>
        </div>
      </section>
<Learnby />
  <SiteFooter />
    </>
  );
}

// Note: static pages list generation was moved into the top-level getServerSideProps
// to avoid mixing SSG (`getStaticProps`) with SSR (`getServerSideProps`).

function FeaturedCarouselSlide({ articleId, preloadedArticle }){

  const [article, setArticle] = useState(preloadedArticle || null)
  useEffect(()=>{
    let mounted = true
    // If a preloadedArticle is provided, use it and skip the network fetch
    if (preloadedArticle) {
      if (mounted) setArticle(preloadedArticle)
      return ()=>{ mounted = false }
    }
    async function load(){
      try{
        const res = await fetch('/api/articles/' + encodeURIComponent(String(articleId)))
        if (!res.ok) {
          const body = await res.text().catch(()=>null)
          console.error('FeaturedCarouselSlide: fetch failed', { articleId, status: res.status, body })
          throw new Error('not found')
        }
        const json = await res.json()
        if (!mounted) return
        // normalize response shapes: API may return the article directly or an envelope { data: ... }
        let art = null
        if (!json) art = null
        else if (Array.isArray(json)) art = json[0] || null
        else if (json.data && (Array.isArray(json.data) || typeof json.data === 'object')) {
          art = Array.isArray(json.data) ? (json.data[0] || null) : json.data
        } else {
          art = json
        }
        // normalize possible snake_case fields coming from Supabase to camelCase used in the UI
        if (art) {
          if (art.cover_image && !art.coverImage) art.coverImage = art.cover_image
          if (art.thumbnail_image && !art.thumbnail) art.thumbnail = art.thumbnail_image
          if (art.cover_alt && !art.coverAlt) art.coverAlt = art.cover_alt
          if (art.published_at && !art.publishedAt) art.publishedAt = art.published_at
        }
        if (art) setArticle(art)
        else {
          console.error('FeaturedCarouselSlide: article not found in response', { articleId, json })
          if (mounted) setArticle(null)
        }
      }catch(e){
        console.error('FeaturedCarouselSlide: error loading article', articleId, e)
        if (mounted) setArticle(null)
      }
    }
    load()
    return ()=>{ mounted = false }
  }, [articleId, preloadedArticle])
  if (!article) {
    return (
      <div className="carousel-slide">
        {/* Neutral skeleton placeholder while the article is fetched — avoids showing stale ChainGPT hero */}
        <div className="cover cover-skeleton" aria-hidden style={{ minHeight: 440, background: 'linear-gradient(90deg,#0e151c, #111827)' }} />
        <div className="body">
          <span className="chips">Loading</span>
          <h1 className="h1">Loading…</h1>
          <p className="meta">—</p>
          <p style={{ opacity: 0.8 }}>Fetching article…</p>
        </div>
      </div>
    )
  }

  const img = article.coverImage || article.cover_image || article.thumbnail || article.thumbnail_image || '/assets/hero-chaingpt.webp'
  const href = article.slug ? `/articles/${article.slug}` : (`/articles/${article.id}`)
  const when = article.createdAt || article.created_at || article.publishedAt || article.published_at ? (new Date(article.createdAt || article.created_at || article.publishedAt || article.published_at)).toLocaleDateString() : ''
  // prefer an explicit featured description (for homepage cards) or ogDescription;
  // do NOT use the article.excerpt here — fallback to the first full sentence from content instead
  function stripHtmlTags(s){ try{ return String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }catch(e){ return String(s||'') }}
  function firstSentenceFromText(s){
    if (!s) return '';
    // Scan for the first sentence terminator (. ! ?) and return the slice up to and including it.
    // Avoid complex RegExp to prevent runtime SyntaxError in some environments/extensions.
    try{
      for (let i = 0; i < s.length; i++){
        const ch = s[i];
        if (ch === '.' || ch === '!' || ch === '?'){
          // look ahead for whitespace and then a plausible sentence-start character
          let j = i + 1;
          while (j < s.length && /\s/.test(s[j])) j++;
          const next = s[j] || '';
          if (j >= s.length || /[A-Z0-9"'\u201c\u201d\u2018\u2019\(\[]/.test(next)){
            return s.slice(0, i + 1).trim();
          }
        }
      }
    }catch(e){ /* fall through to returning whole text */ }
    return s.trim();
  }

  // Prefer the article excerpt for the featured description; fall back to the main content
  const _rawExcerpt = article.excerpt ? stripHtmlTags(article.excerpt) : '';
  const _rawContent = _rawExcerpt || (article.content ? stripHtmlTags(article.content) : '');
  const _firstSentence = _rawContent ? firstSentenceFromText(_rawContent) : '';
  const featuredDesc = article.featuredDescription || article.featured_desc || article.ogDescription || article.og_description || (_firstSentence ? (_firstSentence.endsWith('.') ? _firstSentence + '' : _firstSentence + '') : '')
  const navigateToArticle = (ev) => {
    // If the click originated from an interactive element (link/button), let that element handle it
    try{
      const tag = (ev && ev.target && ev.target.tagName) ? String(ev.target.tagName).toLowerCase() : '';
      if(tag === 'a' || tag === 'button' || (ev && ev.target && ev.target.closest && ev.target.closest('a'))) return
    }catch(e){}
    if (typeof window !== 'undefined') window.location.href = href
  }
  const onKey = (ev) => {
    if (!ev) return
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      if (typeof window !== 'undefined') window.location.href = href
    }
  }

  return (
    <div className="carousel-slide" role="link" tabIndex={0} onClick={navigateToArticle} onKeyDown={onKey}>
      <div className="cover" style={{position:'relative', width:'100%', height: '440px'}}>
        <a href={href} aria-label={article.title || 'Read featured article'} style={{position:'absolute', inset:0, display:'block'}}>
          <Image src={img} alt={article.coverAlt || article.title || 'Featured'} fill style={{objectFit:'cover'}} priority fetchPriority="high" />
        </a>
      </div>
      <div className="body">
        <div>
          <h1 className="h1">{article.title}</h1>
          <span className="meta">{when}{article.content ? ` • ${Math.max(1, Math.round((String(article.content).replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length||0)/200))} min read` : ''}</span>
          <p className="featured-desc">{featuredDesc}</p>
        </div>
        <a className="cta btn-gradient" href={href}>Read full story →</a>
      </div>
    </div>
  )
}

function FeaturedCarousel(){
  const [items, setItems] = React.useState([])
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const trackRef = React.useRef(null)
  const prevIndexRef = React.useRef(0)
  const isTransitioningRef = React.useRef(false)

  React.useEffect(()=>{
    let mounted = true
    async function load(){
      try{
        const qs = new URLSearchParams({ featuredOnly: '1', includeOpinions: '1', page: '1', pageSize: '8' })
        if (process.env.NODE_ENV !== 'production') console.debug('[FeaturedCarousel] fetching featured list')
        const res = await fetch('/api/articles?' + qs.toString())
        if (!res.ok) throw new Error('failed')
        const json = await res.json()
        if (!mounted) return
        const list = Array.isArray(json.data) ? json.data : (json.data || [])
        if (process.env.NODE_ENV !== 'production') console.debug('[FeaturedCarousel] fetched', list)
        setItems(list.slice(0,5))
      }catch(e){ if (mounted) setItems([]) }
    }
    load()
    return ()=>{ mounted = false }
  }, [])

  // autoplay
  React.useEffect(()=>{
    if (paused || items.length <= 1) return
    const t = setInterval(()=> setIndex(i => (i + 1) % items.length), 5000)
    return ()=> clearInterval(t)
  }, [items.length, paused])

  // Prevent jump when wrapping from last -> first by briefly disabling transition
  // Use a layout effect so the transition is disabled before the browser paints the
  // new transform (prevents the long reverse animation). Restore transition on
  // the next animation frame.
  React.useLayoutEffect(()=>{
    try{
      const track = trackRef.current
      if (!track || items.length <= 1) { prevIndexRef.current = index; return }
      const prev = prevIndexRef.current
      // wrapping case: previous was last slide and now index is 0
      if (prev === items.length - 1 && index === 0) {
        // add a class to remove transition, force reflow, then remove the class next frame
        track.classList.add('no-transition')
        track.getBoundingClientRect()
        requestAnimationFrame(()=>{ try{ track.classList.remove('no-transition') }catch(e){} })
      }
      prevIndexRef.current = index
    }catch(e){ /* ignore */ }
  }, [index, items.length])

  if (!items || items.length === 0) {
    return (
      <article className="feature">
        <button className="carousel-arrow left" aria-label="Previous" disabled>
          <svg width="18" height="18" fill="none" stroke="#14f195" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="carousel-track" />
        <button className="carousel-arrow right" aria-label="Next" disabled>
          <svg width="18" height="18" fill="none" stroke="#14f195" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </article>
    )
  }

  const goPrev = ()=> setIndex(i => (i - 1 + items.length) % items.length)
  const goNext = ()=> setIndex(i => (i + 1) % items.length)

  return (
    <article className="feature" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
      <button className="carousel-arrow left" aria-label="Previous" onClick={goPrev}>
        <svg width="18" height="18" fill="none" stroke="#14f195" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
      </button>
  <div ref={trackRef} className="carousel-track" data-react="1" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((it, idx)=> (
          <div key={it && (it.id || it.slug) || idx} style={{ minWidth: '100%' }}>
            <FeaturedCarouselSlide articleId={it && (it.id || it.slug)} />
          </div>
        ))}
      </div>
      <button className="carousel-arrow right" aria-label="Next" onClick={goNext}>
        <svg width="18" height="18" fill="none" stroke="#14f195" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </article>
  )
}
