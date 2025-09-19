import React, { useEffect } from 'react'
import Head from 'next/head'

export default function Learnby({ guides = [] }){
  useEffect(()=>{
    let mod;
    // dynamically import client enhancements only on the client like GuideLayout
    import('../lib/guide-client').then(m=>{ mod = m; try{ m.init && m.init(); }catch(e){} });
    return ()=>{ try{ mod && mod.destroy && mod.destroy(); }catch(e){} };
  }, []);
  // Keep the same 8 categories used by the mock homepage
  const categories = [
    { key: 'bitcoin', title: 'Bitcoin', img: '/uploads/bitcoinguide.webp', desc: 'Bitcoin fundamentals, wallets, and safety.' },
    { key: 'eth', title: 'Ethereum', img: '/uploads/ethereumguide.webp', desc: 'Smart contracts and the Ethereum ecosystem.' },
    { key: 'defi', title: 'DeFi', img: '/uploads/defiguides.webp', desc: 'Decentralized finance protocols and use-cases.' },
    { key: 'wallets', title: 'Wallets', img: '/uploads/1756483546781-ChatGPT-Image-Aug-29,-2025,-08_59_31-PM.webp', desc: 'Custodial vs non-custodial and best practices.' },
    { key: 'regulation', title: 'Regulation', img: '/assets/regulation.webp', desc: 'Overview of the global regulatory landscape for blockchain.' },
    { key: 'trading', title: 'Trading', img: '/assets/markets.webp', desc: 'Trading basics, risk, and strategies.' },
    { key: 'scaling', title: 'Scaling', img: '/assets/scaling.webp', desc: 'Layer 2s, rollups, and performance.' },
    { key: 'nfts', title: 'NFTs', img: '/assets/nfts.webp', desc: 'Non-fungible tokens and creative economy.' }
  ]

  return (
    <>
      <Head>
        <link rel="stylesheet" href="/styles/guides-layout.css" />
      </Head>
      <style jsx global>{`
        /* Override guide-layout.css for this component: remove 1px border and set image height */
        .learn-more .learn-card { border: none !important; box-shadow: none !important; }
        .card-visual img { height: 220px !important; width: 100% !important; object-fit: cover !important; }
      `}</style>

      {/* Learning Paths (copied/adapted from pages/mock/home-with-guides.js) */}
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
              : (path === 'Intermediate' ? '/uploads/markets.webp' : (path === 'Advanced' ? '/assets/advanced.webp' : `/assets/guides/${path.toLowerCase()}.jpg`))
            const titleColor = path === 'Intermediate' ? '#ffd600' : (path === 'Advanced' ? '#14f195' : '#ffffff')
            return (
              <div key={path} style={{background:'linear-gradient(180deg, rgba(255,255,255,0.01), transparent)', padding:10, borderRadius:10, display:'flex', gap:12, alignItems:'flex-start', border: 'none'}}>
                <div style={{width:96,height:120,minHeight:120,flex:'0 0 96px', borderRadius:10, backgroundSize:'cover', backgroundPosition:'center', backgroundImage:`url(${img})`}} />
                <div style={{flex:1}}>
                  <h4 style={{margin:'0 0 6px', color:titleColor, fontSize:15, fontWeight:500}}>{path}</h4>
                  <p style={{margin:'0 0 8px', color:'#bfcfc4', fontSize:13}}>{list.length || (guides || []).length} guides • curated path</p>
                  <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-start'}}>
                    {list.length ? list.map(g => (
                      <a key={g.id || g.slug || g.title} href={g.slug ? `/guides/${g.slug}` : '#'} style={{display:'block', textDecoration:'none', color:'inherit', padding:'4px 0', background:'transparent', fontSize:13, textAlign:'left'}}>{g.title && g.title.slice ? g.title.slice(0,36) : (g.title || '')}</a>
                    )) : <div style={{color:'#9bb0ac', fontSize:13}}>No sample guides</div>}
                  </div>
                  <div style={{marginTop:8}}><a href={`/guides?path=${encodeURIComponent(path)}`} style={{color:'#14f195', textDecoration:'none', fontWeight:600, fontSize:13}}>Start this path →</a></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <section className="learn-more">
        <div className="learn-inner">
          <h3>Learn more about blockchain technology</h3>
          <div className="cards-viewport">
            <div className="cards-track" role="list">
              {categories.map(cat => (
                <article className="learn-card" role="listitem" key={cat.key}>
                  <div className="card-visual" aria-hidden>
                    <img src={cat.img && String(cat.img).startsWith('/') ? (cat.img.indexOf('/uploads') !== -1 ? `/api/image-resize?path=${encodeURIComponent(cat.img)}` : cat.img) : cat.img} alt={cat.title + ' image'} />
                  </div>
                  <div className="card-caption">
                    <h4>{cat.title}</h4>
                    <p>{cat.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="cards-nav" aria-hidden>
            <button className="cards-prev" aria-label="Scroll left">◀</button>
            <button className="cards-next" aria-label="Scroll right">▶</button>
          </div>
        </div>
      </section>
    </>
  )
}
