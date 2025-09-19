#!/usr/bin/env node
/**
 * Script to publish three featured articles from featured.html content.
 * Run: node scripts/publish-featured.js
 */
const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function upsertArticle(data) {
  const slug = data.slug;
  const now = new Date();
  const up = await prisma.article.upsert({
    where: { slug },
    update: {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      coverImage: data.coverImage || null,
      thumbnail: data.thumbnail || null,
      category: data.category || 'News',
      subcategory: data.subcategory || null,
      author: data.author || 'Cointist',
      published: true,
      publishedAt: now,
      pinned: data.pinned || false,
      coverAlt: data.coverAlt || null,
      thumbnailAlt: data.thumbnailAlt || null
    },
    create: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      coverImage: data.coverImage || null,
      thumbnail: data.thumbnail || null,
      category: data.category || 'News',
      subcategory: data.subcategory || null,
      author: data.author || 'Cointist',
      published: true,
      publishedAt: now,
      pinned: data.pinned || false,
      coverAlt: data.coverAlt || null,
      thumbnailAlt: data.thumbnailAlt || null
    }
  });
  return up;
}

async function main(){
  const articles = [
    {
      slug: 'crypto-pr-campaign',
      title: "Crypto’s Greatest PR Campaign: Why Declaring Bitcoin Dead Keeps It Alive",
      excerpt: "If Bitcoin had a marketing department, it couldn’t have scripted a better funnel: the never-ending cycle of ‘Bitcoin is dead’ headlines fuels awareness and recruitment.",
      content: `
<div class="tag">Opinion</div>
<div class="tag">Narratives</div>
<h2>Crypto’s Greatest PR Campaign: Why Declaring Bitcoin Dead Keeps It Alive</h2>
<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4 min</div></div>
<p class="lede">If Bitcoin had a marketing department, it couldn’t have scripted a better funnel than the never-ending cycle of “Bitcoin is dead” headlines. Each obituary triggers outrage, sharing, and fresh attention from audiences that weren’t paying attention yesterday.</p>
<h3 class="subhead">The Streisand Effect at Work</h3>
<p>The phenomenon is a textbook case of the <em>Streisand effect</em>: efforts to dismiss or bury something inadvertently publicize it. Every viral takedown rehearses the core talking points—scarcity, decentralization, censorship resistance—and brings new readers to explanatory content.</p>
<h3 class="subhead">Volatility as Narrative Fuel</h3>
<p>Bitcoin’s resilience compounds this effect. Price drawdowns make for dramatic headlines, but the network’s operational continuity rarely stops. That contrast—<em>volatile price, durable rails</em>—creates narrative tension, keeping Bitcoin in the spotlight.</p>
<div class="callout">Obituaries are anti-fragile fuel. Each “death” raises the baseline of public literacy about how Bitcoin actually works—and why it keeps returning to the front page.</div>
<h3 class="subhead">Cycles of Doom and Revival</h3>
<p>During macro stress, when liquidity tightens, declarations of doom multiply. In response, long-term holders surface metrics like <strong>self-custody growth</strong> and <strong>supply dormancy</strong>, contextualizing volatility as temporary noise in a long arc of adoption.</p>
<h3 class="subhead">The Limits of Memetics</h3>
<p>Memes can’t replace utility or protect against regulatory shocks, but they do subsidize awareness. Ironically, the loudest skeptics become distribution partners for the very system they doubt.</p>
<p class="foot">Bottom line: Bitcoin doesn’t just survive its obituaries; it metabolizes them into reach, literacy, and recruitment.</p>
`,
      category: 'Opinions',
      subcategory: 'Narratives',
      pinned: true
    },
    {
      slug: 'remittances-mexico',
      title: 'Remittances 2.0: How Mexico Became Ground Zero for Crypto’s Real Adoption Story',
      excerpt: 'The U.S.–Mexico remittance corridor is the world’s largest by volume, making it the perfect proving ground for crypto rails where speed, cost and UX matter.',
      content: `
<div class="tag">Adoption</div>
<div class="tag">Payments</div>
<h2>Remittances 2.0: How Mexico Became Ground Zero for Crypto’s Real Adoption Story</h2>
<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4–5 min</div></div>
<p class="lede">The U.S.–Mexico remittance corridor is the world’s largest by volume. That makes it the perfect proving ground for crypto rails—where seconds matter, fees are felt, and user experience wins or loses customers.</p>
<h3 class="subhead">The Pain Points of Legacy Rails</h3>
<p>Traditional transfers involve correspondent banks, hidden FX spreads, and days of delays. Crypto settlement offers near-instant clearing, transparent FX, and programmable compliance—attacking each inefficiency directly.</p>
<h3 class="subhead">Why Mexico Leads the Charge</h3>
<ul><li>Massive recurring flows between U.S. workers and Mexican households</li><li>High smartphone penetration and digital-savvy users</li><li>Local fintechs ready to bridge dollars, stablecoins, and pesos</li></ul>
<div class="callout">Product truth: users don’t care whether it’s Lightning or stablecoin rails—they care about <strong>speed, spread, and certainty</strong>.</div>
<h3 class="subhead">Defining a Best-in-Class Product</h3>
<p>Three benchmarks stand out: <strong>FX fairness</strong>, <strong>time-to-wallet</strong> measured in minutes, and <strong>failure rate</strong> approaching zero. Add recurring transfers and bilingual support, and crypto rails become invisible infrastructure for families.</p>
<h3 class="subhead">Scaling Challenges</h3>
<p>Treasury management, regulatory alignment, and fraud prevention remain hurdles. Yet when solved, the reward is a service priced like software but impacting millions of households.</p>
<p class="foot">Mexico is the testbed for crypto’s most credible utility: moving money for real people, on real deadlines.</p>
`,
      category: 'Adoption',
      subcategory: 'Payments',
      pinned: true
    },
    {
      slug: 'liquidity-wars',
      title: 'Liquidity Wars: Exchanges, Custodians, and the Silent Battle for Institutional Crypto',
      excerpt: 'The contest for institutional crypto is won by the platform that fuses execution depth, custody safety, and capital efficiency.',
      content: `
<div class="tag">Markets</div>
<div class="tag">Institutions</div>
<h2>Liquidity Wars: Exchanges, Custodians, and the Silent Battle for Institutional Crypto</h2>
<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4–5 min</div></div>
<p class="lede">In crypto, everyone sells liquidity—but not the same kind. Exchanges sell depth, custodians sell safety, and prime brokers promise efficiency. The real contest lies in who can fuse all three for institutional players.</p>
<h3 class="subhead">Three Fronts of the Battle</h3>
<ul><li><strong>Price discovery</strong>: CEXs still dominate, but on-chain venues experiment with advanced order types.</li><li><strong>Asset safety</strong>: Qualified custody and bankruptcy-remote structures are now table stakes.</li><li><strong>Capital efficiency</strong>: Unified margin and collateral mobility determine stickiness of flow.</li></ul>
<div class="callout">The new moat is <em>integration</em>: execution venues that plug directly into trusted custody and settlement, cutting operational drag without trapping client assets.</div>
<h3 class="subhead">Signals to Watch</h3>
<p>Institutions watch attestation cadence, segregation clarity, margin portability, and fiat latency. These metrics are emerging as KPIs in a liquidity franchise race.</p>
<h3 class="subhead">CEX + DEX: Toward Hybrid Liquidity</h3>
<p>DEXs are solving for MEV, oracle robustness, and compliant access layers. The likely future isn’t “CEX vs DEX” but hybrid liquidity that merges deep books with on-chain settlement.</p>
<p class="foot">Institutions don’t want to choose between safety and speed. The franchise that fuses depth, transparency, and efficiency will define the next cycle of crypto markets.</p>
`,
      category: 'Markets',
      subcategory: 'Institutions',
      pinned: true
    }
  ];

  for (const art of articles){
    try{
      const res = await upsertArticle(art);
      console.log('Upserted:', res.id, res.slug, res.title);
    }catch(e){
      console.error('Failed to upsert', art.slug, e && e.message ? e.message : e);
    }
  }

  // close prisma
  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
