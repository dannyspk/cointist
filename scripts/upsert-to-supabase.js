#!/usr/bin/env node
// Upsert three featured articles into Supabase using SUPABASE_SERVICE_ROLE_KEY from .vercel.env
// Run: node scripts/upsert-to-supabase.js

require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.vercel.env)');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const nowIso = (new Date()).toISOString();

const articles = [
  {
    slug: 'crypto-pr-campaign',
    title: "Crypto’s Greatest PR Campaign: Why Declaring Bitcoin Dead Keeps It Alive",
    excerpt: "If Bitcoin had a marketing department, it couldn't have scripted a better funnel: the never-ending cycle of 'Bitcoin is dead' headlines fuels awareness and recruitment.",
    content: `\n<div class="tag">Opinion</div>\n<div class="tag">Narratives</div>\n<h2>Crypto’s Greatest PR Campaign: Why Declaring Bitcoin Dead Keeps It Alive</h2>\n<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4 min</div></div>\n<p class="lede">If Bitcoin had a marketing department, it couldn't have scripted a better funnel than the never-ending cycle of "Bitcoin is dead" headlines. Each obituary triggers outrage, sharing, and fresh attention from audiences that weren't paying attention yesterday.</p>\n<h3 class="subhead">The Streisand Effect at Work</h3>\n<p>The phenomenon is a textbook case of the <em>Streisand effect</em>: efforts to dismiss or bury something inadvertently publicize it. Every viral takedown rehearses the core talking points—scarcity, decentralization, censorship resistance—and brings new readers to explanatory content.</p>\n<h3 class="subhead">Volatility as Narrative Fuel</h3>\n<p>Bitcoin's resilience compounds this effect. Price drawdowns make for dramatic headlines, but the network's operational continuity rarely stops. That contrast—<em>volatile price, durable rails</em>—creates narrative tension, keeping Bitcoin in the spotlight.</p>\n<div class="callout">Obituaries are anti-fragile fuel. Each "death" raises the baseline of public literacy about how Bitcoin actually works—and why it keeps returning to the front page.</div>\n<h3 class="subhead">Cycles of Doom and Revival</h3>\n<p>During macro stress, when liquidity tightens, declarations of doom multiply. In response, long-term holders surface metrics like <strong>self-custody growth</strong> and <strong>supply dormancy</strong>, contextualizing volatility as temporary noise in a long arc of adoption.</p>\n<h3 class="subhead">The Limits of Memetics</h3>\n<p>Memes can't replace utility or protect against regulatory shocks, but they do subsidize awareness. Ironically, the loudest skeptics become distribution partners for the very system they doubt.</p>\n<p class="foot">Bottom line: Bitcoin doesn’t just survive its obituaries; it metabolizes them into reach, literacy, and recruitment.</p>\n`,
    category: 'Opinions',
    subcategory: 'Narratives',
    author: 'Cointist',
  pinned: true,
  published: true,
  publishedAt: nowIso,
  coverImage: null,
  thumbnail: null,
  coverAlt: null,
  thumbnailAlt: null
  },
  {
    slug: 'remittances-mexico',
    title: 'Remittances 2.0: How Mexico Became Ground Zero for Crypto’s Real Adoption Story',
    excerpt: 'The U.S.–Mexico remittance corridor is the world’s largest by volume, making it the perfect proving ground for crypto rails where speed, cost and UX matter.',
    content: `\n<div class="tag">Adoption</div>\n<div class="tag">Payments</div>\n<h2>Remittances 2.0: How Mexico Became Ground Zero for Crypto’s Real Adoption Story</h2>\n<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4–5 min</div></div>\n<p class="lede">The U.S.–Mexico remittance corridor is the world’s largest by volume. That makes it the perfect proving ground for crypto rails—where seconds matter, fees are felt, and user experience wins or loses customers.</p>\n<p class="foot">Mexico is the testbed for crypto’s most credible utility: moving money for real people, on real deadlines.</p>\n`,
    category: 'Adoption',
    subcategory: 'Payments',
    author: 'Cointist',
  pinned: true,
  published: true,
  publishedAt: nowIso,
  coverImage: null,
  thumbnail: null,
  coverAlt: null,
  thumbnailAlt: null
  },
  {
    slug: 'liquidity-wars',
    title: 'Liquidity Wars: Exchanges, Custodians, and the Silent Battle for Institutional Crypto',
    excerpt: 'The contest for institutional crypto is won by the platform that fuses execution depth, custody safety, and capital efficiency.',
    content: `\n<div class="tag">Markets</div>\n<div class="tag">Institutions</div>\n<h2>Liquidity Wars: Exchanges, Custodians, and the Silent Battle for Institutional Crypto</h2>\n<div class="meta"><div>Published: Aug 25, 2025</div><div>Reading time: ~4–5 min</div></div>\n<p class="lede">In crypto, everyone sells liquidity—but not the same kind. Exchanges sell depth, custodians sell safety, and prime brokers promise efficiency. The real contest lies in who can fuse all three for institutional players.</p>\n<p class="foot">The franchise that fuses depth, transparency, and efficiency will define the next cycle of crypto markets.</p>\n`,
    category: 'Markets',
    subcategory: 'Institutions',
    author: 'Cointist',
  pinned: true,
  published: true,
  publishedAt: nowIso,
  coverImage: null,
  thumbnail: null,
  coverAlt: null,
  thumbnailAlt: null
  }
];

async function main(){
  for (const art of articles){
    try{
      // Upsert by slug
      const { data, error } = await supa.from('Article').upsert([art], { onConflict: 'slug' }).select();
      if (error) {
        console.error('Upsert failed for', art.slug, error.message || error);
      } else {
        console.log('Upserted:', (data && data[0] && data[0].id) ? data[0].id : '(no id)', art.slug);
      }
    }catch(e){
      console.error('Exception upserting', art.slug, e.message || e);
    }
  }
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
