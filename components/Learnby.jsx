import React, { useEffect } from 'react'
import Head from 'next/head'
import LearnbyRight from './LearnbyRight'

export default function Learnby({ guides = [], hideHeader = false }){
  useEffect(()=>{
    let mod;
    // dynamically import client enhancements only on the client like GuideLayout
    import('../lib/guide-client').then(m=>{ mod = m; try{ m.init && m.init(); }catch(e){} });
    return ()=>{ try{ mod && mod.destroy && mod.destroy(); }catch(e){} };
  }, []);
  // Keep the same 8 categories used by the mock homepage
  const categories = [
    { key: 'bitcoin', title: 'Bitcoin', img: '/uploads/bitcoinguide.png', desc: 'Bitcoin fundamentals, wallets, and safety.' },
    { key: 'eth', title: 'Ethereum', img: '/uploads/ethereumguide.png', desc: 'Smart contracts and the Ethereum ecosystem.' },
    { key: 'regulation', title: 'Regulation', img: '/uploads/regulation.png', desc: 'Overview of the global regulatory landscape for blockchain.' },
    { key: 'wallets', title: 'Wallets', img: '/uploads/wallets.png', desc: 'Custodial vs non-custodial and best practices.' },
    { key: 'defi', title: 'DeFi', img: '/uploads/defiguides.webp', desc: 'Decentralized finance protocols and use-cases.' },
    { key: 'trading', title: 'Trading', img: '/assets/markets.webp', desc: 'Trading basics, risk, and strategies.' },
    { key: 'scaling', title: 'Scaling', img: '/assets/scaling.webp', desc: 'Layer 2s, rollups, and performance.' },
    { key: 'nfts', title: 'NFTs', img: '/assets/nfts.webp', desc: 'Non-fungible tokens and creative economy.' }
  ]

  // mapping from local category keys to learn-by-category section ids
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

  return (
    <>
      { !hideHeader && (
        <Head>
          <link rel="stylesheet" href="/styles/guides-layout.css" />
        </Head>
      ) }
  <style jsx global>{`
  /* Override guide-layout.css for this component: remove 1px border and set image height */
  .learn-card { box-shadow: none !important; position: relative; overflow: hidden; }
  /* clickable overlay inside the card so we don't wrap the entire element with an anchor (which broke layout) */
  .card-link-overlay { position: absolute; inset: 0; z-index: 4; display: block; text-indent: -9999px; }
        .wrap{max-width: 1820px !important;
    margin: 24px auto !important;
    padding: 0 20px;}
    .learn-more {
      max-width: 1200px !important;
      margin: 40px auto !important;
      padding: 0 5px !important;
    }
      .learn-inner {
        max-width: 1090px !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

    /* Homepage-specific overrides to tighten spacing and avoid a large gap
      between the main column and the right sidebar when Learnby is embedded
      on the homepage. These rules are scoped to .learnby-home so other pages
      (like /learning-path) keep their original layout. */
    .learnby-home .learnby-grid { grid-template-columns: 1fr 320px !important; gap:22px !important; margin-left: 0 !important; max-width: none !important; }
    .learnby-home .learnby-right { margin-left: 0 !important; width: 320px !important; }
    .learnby-home :global(.browse-all) { display: none !important; }

      .cards-nav { position: absolute;
    left: 18px;
    bottom: 6px !important;
    display: flex;
    gap: 12px;
    z-index: 15; }
    .card-visual img { height: 220px !important; width: 100% !important; object-fit: cover !important; }

    /* Mobile-only fixes (do not change desktop styles) */
    @media (max-width: 700px) {
      /* Stack Learning Paths (grid/inline-flex wrapper) into a single column */
      /* target the div immediately after the Learning Paths h3 */
      h3 + div { display: grid !important; grid-template-columns: 1fr !important; gap: 12px !important; }

      /* Scroller: make it touch-friendly and show one card-per-viewport */
      .cards-viewport { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
      .cards-track { gap: 12px !important; padding-bottom: 28px !important; scroll-snap-type: x mandatory !important; }
      .learn-card { flex: 0 0 86% !important; max-width: 86% !important; margin: 0 7% !important; box-sizing: border-box !important; padding: 10px !important; border-radius: 10px !important; }
      .card-visual img { height: 156px !important; object-fit: cover !important; }
      .learn-inner h3 { font-size: 20px !important; text-align: left !important; }
      .cards-nav { display: none !important; }
    }


    @media (max-width: 480px) {
      .learn-card { flex: 0 0 86% !important; max-width: 86% !important; margin: 0 7% !important; }
      .card-visual img { height: 96px !important; object-fit: contain !important; }
      .learn-inner h3 { text-align: center !important; }
    }

    /* Learning Paths - distinct card styles to break monotony */
    .path-card { padding: 12px; border-radius: 12px; display:flex; gap:12px; align-items:flex-start; color:var(--path-text,#ffffff); min-width:260px; background: transparent; box-shadow: none; border-left: 4px solid transparent;     margin-top: 5px;     margin-left: 5px;}
    .path-card .path-thumb { width:96px; height:110px; flex:0 0 96px; border-radius:8px; background-size:cover; background-position:center; box-shadow: none; border: 1px solid rgba(255,255,255,0.03); }
    .path-card h4{ margin:0 0 6px; font-size:15px; font-weight:600; }
    .path-card p{ margin:0 0 8px; color:rgba(255,255,255,0.85); font-size:13px }
    .path-card a.start-link{ color:inherit; text-decoration:none; font-weight:700; margin-top:8px; display:inline-block; }

    /* Remove heavy gradients; use subtle border accent per-path. Hover uses a soft lift */
    @media (hover: hover) and (min-width: 700px){
      .path-card{ transition: transform 160ms ease, box-shadow 160ms ease }
      .path-card:hover{ transform: translateY(-4px); box-shadow: 0 8px 18px rgba(2,6,9,0.35) }
    }
      `}</style>

      <style jsx>{`
  .learnby-grid{ display:grid; grid-template-columns: 1fr 440px; align-items:start; background: linear-gradient(180deg, rgb(28 36 32 / 45%), rgba(8, 12, 10, 0.38)); border: 1px solid rgba(20,241,149,0.04); gap: 22px; }
        .learnby-main{ max-width:1200px; margin-left:8px; }
        .learnby-right{ align-self:start; padding-top:48px;  }

  /* Right column panel - match .learn-card tokens so it blends visually */
  .learnby-right-panel { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.003)); padding: 12px; border-radius: 10px; border: 1px solid rgba(109,255,165,0.06); box-shadow: 0 2px 8px rgba(2,6,9,0.14); width:100%; }
  .learnby-right-panel :global(.learnby-right) { margin-left: 0; padding-top: 6px; }
  .learnby-right-inner { display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; }

  /* Mobile / tablet adjustments */
  @media (max-width:900px){
    .learnby-grid{ grid-template-columns: 1fr; padding: 14px; gap:18px; }
    .learnby-grid > :global(.learnby-right){ padding-right: 52px; padding-top:12px }
    .learnby-main{ margin-left:0; }
    .learnby-right-panel{ max-width:520px; }
    .learnby-right {display:none;}
  }

  /* Smaller screens: stack nicely, scale thumbnails and tighten spacing */
  @media (max-width:700px){
    .learnby-grid{ padding: 12px; border-radius:10px; }
    .path-card{ min-width: auto; width:100%; display:flex; gap:12px; padding:10px; }
    .path-card .path-thumb{ width:72px; height:72px; flex:0 0 72px; }
    .path-card h4{ font-size:14px }
    .path-card p{ font-size:12px }
    .cards-track { gap: 12px; padding-bottom: 12px; }
    .cards-viewport { overflow-x: auto; }
    .learnby-right-panel{ padding: 14px; border-radius:10px; }
    .learnby-right-inner{ gap:10px }
    .h2 { font-size:28px; margin-left: 10px; !important}
    .learnby-right-panel {width: 100vw;}
    .learn-inner {width: 100vw;}
  }

  /* Very small devices adjustments */
  @media (max-width:480px){
    .path-card{ padding:8px; gap:8px }
    .path-card .path-thumb{ width:64px; height:64px; }
    .learn-inner h3{ font-size:18px }
    .learnby-right-panel{ padding:12px; }
    .learnby-grid{ background: linear-gradient(180deg, rgba(8,12,10,0.45), rgba(8,12,10,0.35)); padding:10px; }
  }

    c  `}</style>

      <div className="container">
      <div className="learnby-grid" style={{marginTop:12}}>
    <div className="learnby-main">
      {/* Learning Paths (copied/adapted from pages/mock/home-with-guides.js) */}

  <h4 style={{margin:'38px 0', color: hideHeader ? '#0b0d0e' : '#fafbfbff', padding: '0 8px', fontSize: '40px', fontFamily: 'var(--font-head)'}}>Guides</h4>
  <p style={{color:'#9bb0ac', marginTop:0 , padding: '0 8px'}}>Choose a path or browse by category to start a guided learning journey.</p>
      <div>
        <h3 style={{margin:'12px 0' , padding: '0 8px'}}>Learning Paths</h3>
        <div style={{display:'inline-flex', flexWrap:'wrap', gap:96}}>
          {['Beginner','Intermediate','Advanced'].map((path) => {
            const borderColor = path === 'Beginner' ? '#0fbf9a' : (path === 'Intermediate' ? '#ffd54a' : '#14f195')
            const headingColor = path === 'Intermediate' ? '#ffd600' : (path === 'Advanced' ? '#14f195' : '#ffffff')
            const list = (guides || []).filter(g => {
              const key = (g && (g.subcategory || (g.tags && g.tags[0]) || g.category)) || ''
              return String(key).toLowerCase().includes(path.toLowerCase()) || (g && g.level && String(g.level).toLowerCase() === path.toLowerCase())
            }).slice(0,3)
            // static counts per-path as requested
            const staticCounts = { Beginner: 12, Intermediate: 7, Advanced: 6 }
            const totalCount = staticCounts[path] || list.length || (guides || []).length
            const img = path === 'Beginner'
              ? '/assets/web3.webp'
              : (path === 'Intermediate' ? '/uploads/markets.webp' : (path === 'Advanced' ? '/assets/advanced.webp' : `/assets/guides/${path.toLowerCase()}.jpg`))
            return (
              <div key={path} className={`path-card ${path.toLowerCase()}`} style={{border: 'none', borderLeft: `4px solid ${borderColor}`}}>
                <a className="card-link-overlay" href={`/learning-path/${encodeURIComponent(path.toLowerCase())}`} aria-label={`Start ${path} path`} />
                <div className="path-thumb" style={{backgroundImage:`url(${img})`}} />
                <div style={{flex:1}}>
                  <h4 style={{color:headingColor}}>{path}</h4>
                  <p style={{margin:'0 0 8px', fontSize:13, color:'rgba(255,255,255,0.9)'}}>{totalCount} guides • curated path</p>
                  <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-start'}}>
                    {list.length ? list.map(g => (
                      <a key={g.id || g.slug || g.title} href={g.slug ? `/guides/${g.slug}` : '#'} style={{display:'block', textDecoration:'none', color:'inherit', padding:'4px 0', background:'transparent', fontSize:13, textAlign:'left'}}>{g.title && g.title.slice ? g.title.slice(0,36) : (g.title || '')}</a>
                    )) : <div style={{color:'#9bb0ac', fontSize:13}}></div>}
                  </div>
                  <div style={{marginTop:8}}><a className="start-link" href={`/learning-path/${encodeURIComponent(path.toLowerCase())}`}>Start this path →</a></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

  <section className="learn-more">
        <div className="learn-inner">
          <h4 style={{fontSize: '20px', marginBottom: '12px'}}>Learn by Category</h4>
          <div className="cards-viewport">
            <div className="cards-track" role="list">
              {categories.map(cat => {
                const id = (idMap && idMap[cat.key]) || cat.key;
                const imgSrc = cat.img && String(cat.img).startsWith('/') ? (cat.img.indexOf('/uploads') !== -1 ? `/api/image-resize?path=${encodeURIComponent(cat.img)}` : cat.img) : cat.img;
                return (
                  <article className="learn-card" role="listitem" key={cat.key}>
                    {/* overlay link — uses full-card hit area but keeps DOM structure/styling intact */}
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
      </div>{/* .learnby-main */}

    <div className="learnby-right">
        <div className="learnby-right-inner">
          <LearnbyRight />
        </div>
      
    </div>

  </div>{/* .learnby-grid */}
  </div>{/* .container */}
  </>
  )
}