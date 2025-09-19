#!/usr/bin/env node
/**
 * Upsert the wallets-101 guide into the local Prisma DB (by slug).
 * Usage: node scripts/upsert-wallets-101.js
 */
const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function upsertArticle(data) {
  const slug = data.slug;
  const now = new Date();
  const up = await prisma.article.upsert({
    where: { slug },
    update: {
      title: data.title,
      excerpt: data.excerpt || null,
      content: data.content || null,
      coverImage: data.coverImage || null,
      thumbnail: data.thumbnail || null,
      category: data.category || 'Guides',
      subcategory: data.subcategory || null,
      author: data.author || 'Cointist',
      published: data.published || true,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : now,
      pinned: !!data.pinned,
      coverAlt: data.coverAlt || null,
      thumbnailAlt: data.thumbnailAlt || null
    },
    create: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content || null,
      coverImage: data.coverImage || null,
      thumbnail: data.thumbnail || null,
      category: data.category || 'Guides',
      subcategory: data.subcategory || null,
      author: data.author || 'Cointist',
      published: data.published || true,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : now,
      pinned: !!data.pinned,
      coverAlt: data.coverAlt || null,
      thumbnailAlt: data.thumbnailAlt || null
    }
  });
  return up;
}

async function main(){
  // Extracted from c:\Users\Danish\Desktop\wallets-101.html
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
</div>
`;

  // Title pulled from <title> tag: "Wallets 101: Custodial vs Non‑Custodial • Cointist Guides"
  // Use the shorter guide title.
  const title = 'Wallets 101: Custodial vs Non‑Custodial';
  // Excerpt pulled from meta description
  const excerpt = 'Learn how wallets actually work, the difference between custodial and non‑custodial, hot vs cold storage, and security best practices.';
  const art = {
    slug: 'wallets-101',
    title,
    category: 'Guides',
    author: 'Cointist', // assumption: use 'Cointist' as the guide author
    excerpt,
    content,
    published: true,
    publishedAt: new Date().toISOString(),
    pinned: false,
  };

  try{
    const res = await upsertArticle(art);
    console.log('Upserted:', res.id, res.slug, res.title);
  }catch(e){
    console.error('Failed to upsert wallets-101', e && e.message ? e.message : e);
  }finally{
    await prisma.$disconnect();
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
