#!/usr/bin/env node
/**
 * Upsert wallets-101 into Supabase using SUPABASE_SERVICE_ROLE_KEY from .vercel.env
 * Usage: node scripts/upsert-wallets-101-supabase.js
 */
require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .vercel.env');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const nowIso = (new Date()).toISOString();

const content = `
<article>
  <h2 id="how">How wallets work</h2>
  <p>Wallets generate keypairs. The public key becomes your address; the private key signs transactions. A seed phrase can recreate all derived keys—so protect it like cash and identity combined.</p>
  <p><img alt="Key management flow" src="/assets/guides/wallets-keys-flow.webp" style="width:100%;border:1px solid var(--border);border-radius:10px"/></p>

  <div class="divider"></div>

  <h2 id="custody">Custodial vs non‑custodial</h2>
  <ul>
    <li><strong>Custodial:</strong> a platform holds keys (easy recovery; less control).</li>
    <li><strong>Non‑custodial:</strong> you hold keys (full control; full responsibility).</li>
  </ul>
  <p><img alt="Custodial vs Non-custodial" src="/assets/guides/wallets-custodial-vs-non.webp" style="width:100%;border:1px solid var(--border);border-radius:10px"/></p>

  <div class="divider"></div>

  <h2 id="hotcold">Hot vs cold storage</h2>
  <p><em>Hot</em> wallets live on internet‑connected devices—convenient but more exposed. <em>Cold</em> wallets stay offline—less convenient but far safer for savings.</p>
  <p><img alt="Hot vs Cold" src="/assets/guides/wallets-hot-cold.webp" style="width:100%;border:1px solid var(--border);border-radius:10px"/></p>

  <div class="divider"></div>

  <h2 id="security">Security hygiene</h2>
  <ul>
    <li>Never type your seed phrase into a website.</li>
    <li>Use strong device passcodes and a unique wallet password.</li>
    <li>Split funds: a small “daily” wallet; a cold “savings” wallet.</li>
    <li>Review and revoke token approvals periodically.</li>
  </ul>
</article>

<aside class="related">
  <h3>Related Guides</h3>
  <div class="chips">
    <a class="chip" href="/guides/what-is-web3">What Is Web3?</a>
    <a class="chip" href="/guides/blockchain-basics">Blockchain Basics</a>
    <a class="chip" href="/guides/stablecoins-explained">Stablecoins Explained</a>
  </div>
  <p class="note">Educational content. Not financial advice.</p>
</aside>
`;

const art = {
  slug: 'wallets-101',
  title: 'Wallets 101: Custodial vs Non‑Custodial',
  category: 'Guides',
  author: 'Cointist',
  excerpt: 'Learn how wallets actually work, the difference between custodial and non‑custodial, hot vs cold storage, and security best practices.',
  content,
  published: true,
  publishedAt: nowIso,
  pinned: false,
  coverImage: null,
  thumbnail: null,
  coverAlt: null,
  thumbnailAlt: null
};

async function main(){
  try{
    const { data, error } = await supa.from('Article').upsert([art], { onConflict: 'slug' }).select();
    if (error) {
      console.error('Upsert error', error.message || error);
      process.exit(1);
    }
    console.log('Supabase upsert result:', data && data[0] ? data[0] : data);
  }catch(e){
    console.error('Exception upserting to Supabase', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
