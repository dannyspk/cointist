import Head from 'next/head'
import React from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import db from '../../src/lib/db'
import SiteFooter from '../../src/components/SiteFooter'

const MarketMarquee = dynamic(() => import('../../src/components/MarketMarquee'), { ssr: false, loading: () => <div style={{height:36}} /> })

export default function MockHomeWithGuides({ guides = [] }){
  const featured = Array.isArray(guides) ? guides.filter(g=>g.featuredOnly).slice(0,3) : []
  const gridRef = React.useRef(null)
  const scrollerWrapperRef = React.useRef(null)
  const arrowRightRef = React.useRef(null)
  const arrowLeftRef = React.useRef(null)
  const peekRef = React.useRef(null)
  const thumbRef = React.useRef(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    function updateWidth(){
      try{
        const gridEl = gridRef.current
        const scWrap = scrollerWrapperRef.current
  const aRight = arrowRightRef.current
  const aLeft = arrowLeftRef.current
  const aPeek = peekRef.current
  const aThumb = thumbRef.current
  if (gridEl && scWrap) {
          // also set initial scroll so first two scroller items are off-screen
              // prefer the React ref for the scroller wrapper; keep id for backwards compatibility
              const sc = scWrap || (typeof window !== 'undefined' && document.getElementById && document.getElementById('category-scroller'))
          if (sc && sc.children && sc.children.length) {
            // delay measurement slightly so images/fonts can layout
            setTimeout(() => {
  console.debug && console.debug('updateWidth start', { gridEl: gridEl && { clientWidth: gridEl.clientWidth, offsetWidth: gridEl.offsetWidth }, scWrap: scWrap && { clientWidth: scWrap.clientWidth, offsetWidth: scWrap.offsetWidth } })
              try{
                // inner track is the element that holds the cards; try common classnames
                const innerTrack = sc.querySelector('.cards-track') || sc.querySelector('.category-scroller') || sc.children[0]
                const firstCard = innerTrack && innerTrack.children && innerTrack.children[0]
                const cardW = (firstCard && (firstCard.getBoundingClientRect().width || firstCard.clientWidth)) || Math.floor(gridEl.clientWidth / 4)
                const sliver = Math.min(64, Math.max(16, Math.round(cardW * 0.08)))
                sc.scrollLeft = Math.max(0, cardW * 2 - sliver)

                // compute total width of children (gap included) for robust overflow detection
                const gap = 12
                let totalChildrenW = 0
                const trackChildren = (innerTrack && innerTrack.children && innerTrack.children.length) ? innerTrack.children : sc.children
                for (let i = 0; i < trackChildren.length; i++){
                  try{ totalChildrenW += (trackChildren[i].getBoundingClientRect && trackChildren[i].getBoundingClientRect().width) || trackChildren[i].clientWidth || 0 }catch(e){}
                }
                totalChildrenW += Math.max(0, (trackChildren.length - 1) * gap)
                const wrapperClientW = scWrap.clientWidth || 0
                // Ensure the inner track has an explicit width so scrollWidth reflects children
                try{
                  if (innerTrack && totalChildrenW > 0){
                    innerTrack.style.width = totalChildrenW + 'px'
                    // also set a minWidth so flexible parents can't collapse the track
                    innerTrack.style.minWidth = totalChildrenW + 'px'
                    // ensure the scroller wrapper can overflow horizontally
                    try{ scWrap.style.overflowX = 'auto'; scWrap.style.whiteSpace = 'nowrap' }catch(e){}
                    console.debug && console.debug('set innerTrack.width/minWidth and enabled overflow', { totalChildrenW })
                    // extra diagnostics: report computed sizes and styles immediately after forcing widths
                    try{
                      const innerRect = innerTrack.getBoundingClientRect && innerTrack.getBoundingClientRect()
                      const scRect = sc.getBoundingClientRect && sc.getBoundingClientRect()
                      const innerOffset = innerTrack.offsetWidth
                      const scScrollW = sc.scrollWidth
                      const scClientW = sc.clientWidth
                      const csSc = window.getComputedStyle && window.getComputedStyle(sc)
                      const csInner = window.getComputedStyle && window.getComputedStyle(innerTrack)
                      console.debug && console.debug('post-set diagnostics', { innerRect, innerOffset, innerStyleWidth: innerTrack.style.width, scScrollW, scClientW, scRect, scComputed: { overflowX: csSc && csSc.overflowX, whiteSpace: csSc && csSc.whiteSpace, display: csSc && csSc.display }, innerComputed: { display: csInner && csInner.display, boxSizing: csInner && csInner.boxSizing } })
                    }catch(e){ console.debug && console.debug('post-set diagnostics failed', e) }

                    // If children exceed wrapper width, force an initial offset so arrows have room
                    if (totalChildrenW > wrapperClientW){
                      try{
                        const initialOffset = Math.max(0, Math.round(cardW * 2 - sliver))
                        sc.scrollLeft = Math.min(Math.max(0, initialOffset), Math.max(0, totalChildrenW - wrapperClientW))
                        console.debug && console.debug('forced initial scrollLeft', { initialOffset, after: sc.scrollLeft })
                      }catch(e){ console.debug && console.debug('failed to set initial scrollLeft', e) }
                    }
                  }
                }catch(e){ console.debug && console.debug('failed to set innerTrack width/minWidth', e) }
                // diagnose parent constraints: log up the chain a couple of parents
                try{
                  const parents = []
                  let p = scWrap
                  for (let i=0;i<4 && p; i++){ parents.push({ tag: p.tagName, rect: p.getBoundingClientRect && p.getBoundingClientRect() }) ; p = p.parentElement }
                  console.debug && console.debug('category scroller parent chain', parents)
                }catch(e){}
                const isOverflowing = totalChildrenW > wrapperClientW + 1
                console.debug && console.debug('category scroller measurements', { totalChildrenW, wrapperClientW, scrollWidth: sc.scrollWidth, childCount: trackChildren.length })

                if (isOverflowing){
                  // reveal the inner track (the visual scroller) and allow pointer events
                  if (innerTrack) { innerTrack.style.opacity = ''; innerTrack.style.pointerEvents = 'auto' }
                  if (aRight) aRight.style.display = ''
                  if (aLeft) aLeft.style.display = ''
                  if (aPeek) aPeek.style.display = ''
                  if (aThumb) aThumb.style.display = ''

                  try{
                    const scrollLeft = sc.scrollLeft || 0
                    const scrollWidth = sc.scrollWidth || Math.max(totalChildrenW, 1)
                    const clientWidth = wrapperClientW || 1
                    const maxScroll = Math.max(1, scrollWidth - clientWidth)
                    const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll))
                    const leftPct = 8
                    const rightPct = 8
                    const viewRatio = clientWidth / scrollWidth || 0.15
                    const thumbWidthPct = Math.max(6, Math.min(70, Math.round(viewRatio * 100)))
                    const thumbLeftPct = Math.round(leftPct + ( (100 - leftPct - rightPct - thumbWidthPct) * progress ))
                    if (aThumb && aThumb.firstElementChild){
                      aThumb.firstElementChild.style.left = thumbLeftPct + '%'
                      aThumb.firstElementChild.style.width = thumbWidthPct + '%'
                    }
                  }catch(e){}
                } else {
                  if (innerTrack) { innerTrack.style.opacity = '0'; innerTrack.style.pointerEvents = 'none' }
                  if (aRight) aRight.style.display = 'none'
                  if (aLeft) aLeft.style.display = 'none'
                  if (aPeek) aPeek.style.display = 'none'
                  if (aThumb) aThumb.style.display = 'none'
                }
              }catch(e){ console.debug && console.debug('category scroller: measurement failed', e) }

              // add single scroll listener to keep thumb updated
              try{
                if (!sc.__cointist_listener_added){
                  sc.addEventListener('scroll', updateWidth, { passive: true })
                  sc.__cointist_listener_added = true
                }
              }catch(e){}
            }, 40)
          }
          // reveal scroller wrapper now that measurement is complete
          try{ scWrap.style.visibility = 'visible' }catch(e){}
        }
        // position arrows at the right edge of the grid
        if (gridEl && aRight) {
          const rect = gridEl.getBoundingClientRect()
          const parentRect = gridEl.parentElement.getBoundingClientRect()
          // compute left relative to scroller wrapper container
          const left = rect.right - parentRect.left - 42 // 42px to place at edge
          aRight.style.left = `${left}px`
          aRight.style.top = `${rect.top - parentRect.top + rect.height / 2}px`
        }
        if (gridEl && aLeft) {
          const rect = gridEl.getBoundingClientRect()
          const parentRect = gridEl.parentElement.getBoundingClientRect()
          const left = rect.left - parentRect.left + 6
          aLeft.style.left = `${left}px`
          aLeft.style.top = `${rect.top - parentRect.top + rect.height / 2}px`
        }
      }catch(e){/* ignore */}
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // helper to scroll the category scroller reliably with fallbacks and diagnostics
  function scrollCategory(dir = 'right', event){
    try{
      // prefer the React ref (safer during hydration/react lifecycle)
      const scRef = scrollerWrapperRef && scrollerWrapperRef.current
      const scById = (typeof window !== 'undefined') ? document.getElementById('category-scroller') : null
      // event-target closest fallback
      let scFromEvent = null
      try{ if (event && event.currentTarget && event.currentTarget.closest) scFromEvent = event.currentTarget.closest('.cards-viewport') }catch(e){}
      // global query fallback
      const scQuery = (typeof window !== 'undefined') ? document.querySelector('.cards-viewport') : null
      const sc = scRef || scById || scFromEvent || scQuery
      const scExists = !!sc
      console.debug && console.debug((dir === 'right' ? 'right' : 'left') + ' arrow clicked', { scExists, usingRef: !!scRef, usingGetById: !!scById })
      if (!sc) return
      const clientW = sc.clientWidth || 0
      const scrollWidth = sc.scrollWidth || 0
      const maxScroll = Math.max(0, scrollWidth - clientW)
      const amount = Math.round(clientW * 0.8) || 360
      console.debug && console.debug('scrollCategory debug', { clientW, scrollWidth, scrollLeft: sc.scrollLeft, maxScroll, amount })
      // prefer scrollBy smooth
      if (typeof sc.scrollBy === 'function'){
        try{
          sc.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
          // verify movement shortly after; if it didn't move, fall back to forcing scrollLeft
          const before = sc.scrollLeft || 0
          setTimeout(() => {
            const after = sc.scrollLeft || 0
            console.debug && console.debug('scrollCategory movement check', { before, after })
            if (Math.abs(after - before) < 4){
              // smooth scroll didn't take effect — force the jump
              try{ const forcedTarget = Math.min(maxScroll, Math.max(0, before + (dir === 'right' ? amount : -amount))); sc.scrollLeft = forcedTarget; console.debug && console.debug('scrollCategory forced jump', { forcedTarget }) }catch(e){ console.debug && console.debug('scrollCategory forced jump failed', e) }
            }
          }, 80)
          return
        }catch(e){ console.debug && console.debug('scrollBy failed', e) }
      }
      // fallback: animate scrollLeft
      const start = sc.scrollLeft || 0
      const target = Math.min(maxScroll, Math.max(0, start + (dir === 'right' ? amount : -amount)))
      const duration = 300
      const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      function step(now){
        const t = Math.min(1, (now - startTime) / duration)
        const eased = (--t)*t*t+1 // easeOut cubic
        sc.scrollLeft = Math.round(start + (target - start) * eased)
        if (Math.abs(sc.scrollLeft - target) > 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }catch(e){ console.debug && console.debug('scrollCategory error', e) }
  }

  // Keep the 8 most relevant categories for current market
  const categories = [
    { key: 'bitcoin', title: 'Bitcoin', img: '/uploads/bitcoinguide.webp', desc: 'Bitcoin fundamentals, wallets, and safety.' },
    { key: 'eth', title: 'Ethereum', img: '/uploads/ethereumguide.webp', desc: 'Smart contracts and the Ethereum ecosystem.' },
    { key: 'defi', title: 'DeFi', img: '/uploads/defiguides.webp', desc: 'Decentralized finance protocols and use-cases.' },
    { key: 'wallets', title: 'Wallets', img: '/uploads/1756483546781-ChatGPT-Image-Aug-29,-2025,-08_59_31-PM.webp', desc: 'Custodial vs non-custodial and best practices.' },
    { key: 'regulation', title: 'Regulation', img: '/assets/regulation.webp', desc: 'Overview of the global regulatory landscape for blockchain.' },
    { key: 'trading', title: 'Trading', img: '/assets/markets.webp', desc: 'Trading basics, risk, and strategies.' },
    { key: 'scaling', title: 'Scaling', img: '/assets/scaling.webp', desc: 'Layer 2s, rollups, and performance.' },

   { key: 'nfts', title: 'NFTs', img: '/assets/nfts.webp', desc: 'Non-fungible tokens and creative economy.' },
  ]
  return (
    <>
    <Head>
  <title>Mock Home — Guides section preview</title>
  <link rel="stylesheet" href="/styles/guides-layout.css" />
  <link rel="stylesheet" href="/styles/mock-home-guides.css" />
    </Head>

      <MarketMarquee />

  <div style={{padding:20, overflowX: 'hidden'}}>
        <div style={{width:'100%', margin:0, boxSizing:'border-box'}}>
          <div style={{marginBottom:16}}>
            <Image src="/assets/banner-1200.webp" alt="Ad" width={1200} height={120} priority />
          </div>

          <section style={{marginBottom:18}}>
            <h1 style={{fontSize:32,margin:0}}>Homepage Mock — Guides Preview</h1>
            <p style={{color:'#9bb0ac'}}>This mock page shows how a Guides section would appear on the homepage above the Sponsored block.</p>
          </section>

          <section style={{marginBottom:20}}>
            <h2 style={{margin:'8px 0', color:'#14f195'}}>Learn</h2>
            <p style={{color:'#9bb0ac', marginTop:0}}>Choose a path or browse by category to start a guided learning journey.</p>

            {/* Learning Paths */}
            <div style={{marginTop:12}}>
              <h3 style={{margin:'12px 0'}}>Learning Paths</h3>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12}}>
                {['Beginner','Intermediate','Advanced'].map((path) => {
                  const list = (guides || []).filter(g => {
                    const key = (g && (g.subcategory || (g.tags && g.tags[0]) || g.category)) || ''
                    return String(key).toLowerCase().includes(path.toLowerCase()) || (g && g.level && String(g.level).toLowerCase() === path.toLowerCase())
                  }).slice(0,3)
                  const img = path === 'Beginner'
                    ? '/assets/web3.webp'
                    : (path === 'Intermediate' ? '/uploads/markets.webp' : `/assets/guides/${path.toLowerCase()}.jpg`)
                  const titleColor = path === 'Intermediate' ? '#ffd600' : (path === 'Advanced' ? '#14f195' : '#ffffff')
                  return (
                    <div key={path} style={{background:'linear-gradient(180deg, rgba(255,255,255,0.01), transparent)', padding:10, borderRadius:10, display:'flex', gap:12, alignItems:'flex-start', border: 'none'}}>
                      <div style={{width:96,height:120,minHeight:120,flex:'0 0 96px', borderRadius:10, backgroundSize:'cover', backgroundPosition:'center', backgroundImage:`url(${img})`}} />
                      <div style={{flex:1}}>
                        <h4 style={{margin:'0 0 6px', color:titleColor, fontSize:15, fontWeight:500}}>{path}</h4>
                        <p style={{margin:'0 0 8px', color:'#bfcfc4', fontSize:13}}>{list.length || (guides || []).length} guides • curated path</p>
                        <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-start'}}>
                          {list.length ? list.map(g => (
                            <a key={g.id || g.slug || g.title} href={g.slug ? `/guides/${g.slug}` : '#'} style={{display:'block', textDecoration:'none', color:'inherit', padding:'4px 0', background:'transparent', fontSize:13, textAlign:'left'}}>{g.title.slice(0,36)}</a>
                          )) : <div style={{color:'#9bb0ac', fontSize:13}}>No sample guides</div>}
                        </div>
                        <div style={{marginTop:8}}><a href={`/guides?path=${encodeURIComponent(path)}`} style={{color:'#14f195', textDecoration:'none', fontWeight:600, fontSize:13}}>Start this path →</a></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
              {/* Learn by Category (reusing the working learn-more markup/styles) */}
              <div style={{marginTop:20, display:'inline-flex', flexDirection:'column', alignItems: 'flex-start'}}>
                <section className="learn-more" style={{paddingLeft:0}}>
                  <div className="learn-inner">
                      <h3 style={{marginLeft:0}}>Learn by Category</h3>
                      <div id="category-scroller" className="cards-viewport cointist-scroller-viewport" ref={scrollerWrapperRef} style={{marginTop:12, paddingLeft:0, paddingRight:0, width: '100%'}}>
                    <div className="cards-track" role="list">
                      {categories.map(cat => (
                        <article className="learn-card" role="listitem" key={cat.key}>
                          <div className="card-visual" aria-hidden>
                              <Image src={cat.img && String(cat.img).startsWith('/') ? (cat.img.indexOf('/uploads') !== -1 ? `/api/image-resize?path=${encodeURIComponent(cat.img)}` : cat.img) : cat.img} alt={cat.title + ' image'} width={320} height={220} />
                            </div>
                          <div className="card-caption">
                            <h4>{cat.title}</h4>
                            <p>{cat.desc}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="cards-nav">
                    <button type="button" className="cards-prev" aria-label="Scroll left" onClick={(e) => scrollCategory('left', e)} onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); scrollCategory('left', e) } }}>◀</button>
                    <button type="button" className="cards-next" aria-label="Scroll right" onClick={(e) => scrollCategory('right', e)} onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); scrollCategory('right', e) } }}>▶</button>
                  </div>
                </div>
              </section>

              {/* styles moved to /public/styles/mock-home-guides.css */}
            </div>

          </section>

        </div>
      </div>
    </>
  )
}

export async function getServerSideProps(){
  try{
    const items = await db.findArticles({ where: { category: 'Guides' }, take: 12 })
    return { props: { guides: items || [] } }
  }catch(e){
    return { props: { guides: [] } }
  }
}
