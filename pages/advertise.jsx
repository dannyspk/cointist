import React, { useEffect } from 'react'
import SiteFooter from '../src/components/SiteFooter'
import SEO from '../src/components/SEO'

// Main HTML extracted from the uploaded advertise.html (only the <main>...</main> block)
const MAIN_HTML = `
<main>
  <!-- ===== HERO ===== -->
  <section class="ad-hero" style="background: linear-gradient(90deg,#fffbe6 0%,#ffe9a3 50%,#ffd166 100%); border-radius:0; box-shadow:none; padding:64px 0 48px 0; text-align:center; position:relative; margin:0; max-width:none; overflow:visible; font-family:'SF Pro Display', Arial, sans-serif;">
  <h1 class="tagline" style="font-size:2.6rem;font-weight:800;letter-spacing:.01em;color:#2d2212;margin-bottom:18px;text-shadow:0 2px 12px #ffe9a3cc;font-family:'SF Pro Display', Arial, sans-serif;">
    Reach the crypto <span class="highlight" style="color:#d89c3a;">audiences</span> that matters
  </h1>
  <div class="desc" style="font-size:1.22rem;color:#222;max-width:700px;margin:0 auto 18px auto;opacity:0.98;text-shadow:0 1px 8px #ffe9a3cc;font-family:'SF Pro Display', Arial, sans-serif;">
      <span style="display:inline-block;padding:10px 0 0 0;font-weight:500;letter-spacing:.01em;color:#222;background:transparent;">Premium placements &bull; Data-driven targeting &bull; Trusted editorial — no hype, just results.</span>
    </div>

    <div class="section-bgtext" style="font-size: 11vw;color:#30ad2726;width:100vw;left:50%;right:50%;top:50%;text-align:center;font-family:'Playfair Display',serif;letter-spacing:-0.04em;z-index:0;">WHY CHOOSE US</div>
    <h2 style="font-family:'Playfair Display',serif;font-size:3.2rem;font-weight:700;color:#111;text-align:center;margin-top:-7.2vw;;z-index:1;position:relative;">Why COINTIST?</h2>
    <div class="choose-features" style="display:flex;justify-content:center;gap:38px;flex-wrap:wrap;margin:122px 0 0 0;">
      <div class="choose-item" style="display:flex;flex-direction:column;align-items:center;max-width:180px;">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none"><path d="M19 5l12 5v7c0 7.5-5.5 14-12 16-6.5-2-12-8.5-12-16V10l12-5z" stroke="#222" stroke-width="2" fill="#2ce561"/></svg>
        <span style="margin-top:10px;font-weight:700;color:#222;font-size:1.08rem;">Brand-safe inventory</span>
      </div>
      <div class="choose-item" style="display:flex;flex-direction:column;align-items:center;max-width:180px;">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none"><circle cx="19" cy="19" r="16" stroke="#2ce561" stroke-width="2"/><circle cx="19" cy="19" r="8" stroke="#222" stroke-width="2"/><circle cx="19" cy="19" r="3" fill="#222"/></svg>
        <span style="margin-top:10px;font-weight:700;color:#222;font-size:1.08rem;">High-intent readers</span>
      </div>
      <div class="choose-item" style="display:flex;flex-direction:column;align-items:center;max-width:180px;">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none"><rect x="7" y="22" width="5" height="9" fill="#2ce561"/><rect x="16" y="16" width="5" height="15" fill="#222"/><rect x="25" y="10" width="5" height="21" fill="#2ce561"/></svg>
        <span style="margin-top:10px;font-weight:700;color:#222;font-size:1.08rem;">Clear measurement</span>
      </div>
      <div class="choose-item" style="display:flex;flex-direction:column;align-items:center;max-width:180px;">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none"><path d="M28 10l-16 16M30 8a2 2 0 0 0-2-2l-2 2 4 4 2-2a2 2 0 0 0-2-2z" stroke="#222" stroke-width="2"/><rect x="8" y="28" width="8" height="2" fill="#2ce561"/></svg>
        <span style="margin-top:10px;font-weight:700;color:#222;font-size:1.08rem;">Editorial quality</span>
      </div>
    </div>
  </section>

  <!-- ===== STATS ===== -->
  <section class="section stats-section" aria-label="Cointist reach" style="box-shadow:none;">
  <div class="stats">
    <div class="stat">
      <img src="/assets/monthlyimpression.webp" alt="Monthly Impressions" style="width:66px;height:66px;margin:18px auto 10px auto;display:block;filter:drop-shadow(0 8px 22px rgba(44,229,97,.18));" />
      <div class="lab">Monthly Impressions</div>
      <div class="num counter" data-target="1200000">1,200,000</div>
    </div>
    <div class="stat">
      <img src="/assets/audienc.webp" alt="Unique Readers" style="width:76px;height:66px;margin:18px auto 10px auto;display:block;filter:drop-shadow(0 8px 22px rgba(44,229,97,.18));" />
      <div class="lab">Unique Readers</div>
      <div class="num counter" data-target="320000">320,000</div>
    </div>
    <div class="stat">
      <img src="/assets/mobile-experience.webp" alt="Mobile Audience" style="width:76px;height:66px;margin:18px auto 10px auto;display:block;filter:drop-shadow(0 8px 22px rgba(44,229,97,.18));" />
      <div class="lab">Mobile Audience</div>
      <div class="num">64%</div>
    </div>
    <div class="stat">
      <img src="/assets/twiitericon.webp" alt="Twitter Followers" style="width:76px;height:66px;margin:18px auto 10px auto;display:block;filter:drop-shadow(0 8px 22px rgba(44,229,97,.18));" />
      <div class="lab">Twitter Followers</div>
      <div class="num">10,000</div>
    </div>
    <div class="stat">
      <img src="/assets/native.webp" alt="Native Ad Experience" style="width:76px;height:66px;margin:18px auto 10px auto;display:block;filter:drop-shadow(0 8px 22px rgba(44,229,97,.18));" />
      <div class="lab">Native Ad Experience</div>
      <div class="num">100%</div>
    </div>

  </section>

  <!-- ===== PACKAGES ===== -->
  <section class="section packages-section">
    <h2 style="color:#000000 !important;">Packages</h2>
    <p class="subcopy">Choose a performance-ready placement or ask for a custom plan.</p>

    <div class="cards">
      <article class="card">
        <span class="ribbon">Most Popular</span>
        <h3>Sponsored Article</h3>
        <div class="price">USD 899</div>
        <div class="meta">1× story • 48h homepage • social push</div>
      </article>

      <article class="card">
        <h3>Homepage Banner</h3>
        <div class="price">USD 1,200</div>
        <div class="meta">Leaderboard/Sidebar • 7 days • up to 250k impressions</div>
      </article>

      <article class="card">
        <h3>Research Partner</h3>
        <div class="price">USD 3,900</div>
  <div class="meta">Co-branded module • newsletter feature</div>
      </article>
    </div>
  </section>

  <!-- ===== SPECS & CONTACT + TESTIMONIALS ===== -->
  <section class="section contact" id="contact">
  <div class="panel specs-panel">
    <h2>Specs</h2>
    <ul class="specs">
      <li>Leaderboard 1200×120 (web), 1080×1080 (social)</li>
      <li>Max 2MB • PNG/JPG/GIF • Click tracking supported</li>
      <li>Transparent labeling: “Sponsored”, “Partner”, “Ad”</li>
    </ul>
    <h2>Contact</h2>
    <p class="subcopy" style="margin-top:8px">Attach creatives &amp; target dates.</p>
    <a class="mailto" href="mailto:ads@cointist.com" style="color:#111 !important;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7l8 6 8-6" stroke="#0b0c0d" stroke-width="2" stroke-linecap="round"/><rect x="3" y="5" width="18" height="14" rx="2" stroke="#0b0c0d" stroke-width="2"/></svg>
      ads@cointist.com
    </a>
  </div>
  <div class="panel partners-panel">
    <h2>What Partners Say</h2>
    <div class="carousel" id="carousel">
      <div class="carousel-track">
        <div class="testi">
          <q>Working with Cointist increased our research distribution and delivered measurable engagement — the co-branded module and newsletter placement performed above expectations.</q>
          <div class="by">— Research Partner</div>
        </div>
        <div class="testi">
          <q>Cointist helped us reach a new audience with real engagement. Editorial team is top-notch.</q>
          <div class="by">— Layer2 Wallet</div>
        </div>
        <div class="testi">
          <q>Great results from the homepage banner and the sponsored article — steady traffic and quality leads.</q>
          <div class="by">— DEX Analytics</div>
        </div>
      </div>
      <div class="dots" aria-hidden="true"></div>
    </div>
  </div>
</section>

<section class="subscribe-band" style="background: linear-gradient(135deg, #ffd166 0%, #e6d8b8 100%); color: #222; padding: 48px 0 38px 0;">
  <div class="container" style="max-width:1200px; margin:auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:32px;">
    <div style="flex:1; min-width:320px;">
      <h2 style="font-family:'Playfair Display',serif; font-size:2.6rem; font-weight:700; margin-bottom:18px; color:#222;text-align: left;">Get the top crypto insights in your inbox—fast.</h2>
      <p style="font-size:1.18rem; font-weight:500; margin-bottom:22px; color:#222;text-align: left;">Sign up for our newsletter and stay ahead with curated news, analysis, and trends. Delivered daily, in minutes.</p>
    </div>
    <form style="flex:1; min-width:320px; display:flex; flex-direction:column; gap:18px; align-items:stretch; text-align:left;">
      <div style="display:flex; gap:22px; width:100%;">
        <div style="flex:1;">
          <label style="display:block; margin-bottom:8px; color:#111; font-weight:700;">Name</label>
          <input type="text" name="name" placeholder="Your name" style="width:100%; border:0; border-bottom:2px solid rgba(0,0,0,0.25); padding:10px 6px; background:transparent; font-size:16px;" />
        </div>
        <div style="flex:1;">
          <label style="display:block; margin-bottom:8px; color:#111; font-weight:700;">Email</label>
          <input type="email" name="email" placeholder="Your email" style="width:100%; border:0; border-bottom:2px solid rgba(0,0,0,0.25); padding:10px 6px; background:transparent; font-size:16px;" />
        </div>
      </div>
      <button type="submit" class="newsletter-btn" style="font-family:'SF Pro Display', 'SF Pro Text', Arial, sans-serif; background:linear-gradient(90deg,#222 0%,#444 100%); color:#ffd166; font-weight:500; font-size:1.18rem; border:none; border-radius:8px; padding:16px 0; width:100%; margin-top:8px; box-shadow:0 2px 12px 0 #ffd16633; cursor:pointer; transition:background 0.2s;">Subscribe now</button>
    </form>
  </div>
</section>

</main>
`

export default function Advertise() {
  useEffect(() => {
    const track = document.querySelector('.partners-panel .carousel-track')
    const dotsContainer = document.querySelector('.partners-panel .dots')
    if (!track) return
    const slides = Array.from(track.children)
    if (slides.length === 0) return

    // ensure slides take full width
    slides.forEach(s => { s.style.minWidth = '100%'; s.style.boxSizing = 'border-box' })

    let current = 0
    function renderDots() {
      if (!dotsContainer) return
      dotsContainer.innerHTML = ''
      slides.forEach((_, idx) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        if (idx === current) btn.classList.add('active')
        btn.addEventListener('click', () => goTo(idx))
        dotsContainer.appendChild(btn)
      })
    }

    function goTo(i) {
      current = (i + slides.length) % slides.length
      track.style.transform = `translateX(-${current * 100}%)`
      renderDots()
    }

    renderDots()
    goTo(0)
    const interval = setInterval(() => goTo(current + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <SEO
        title="Advertise | Cointist"
        description="Advertise with Cointist — premium placements, data-driven targeting, and trusted editorial."
        primaryKeyword="crypto advertising"
        keywords={["advertise","crypto advertising","sponsored content"]}
        canonical="/advertise"
      />

  <link rel="stylesheet" href="/advertise.css" />

  <div className="advertise-page" dangerouslySetInnerHTML={{ __html: MAIN_HTML }} />
      <SiteFooter />
    </>
  )
}
