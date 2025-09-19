#!/usr/bin/env node
// Insert or update four Cointist articles into the local Prisma SQLite DB.
// Usage: node scripts/insert-cointist-articles.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function upsertArticle(a){
  const slug = a.slug
  const now = new Date()
  // Only include fields that exist on the Prisma Article model to avoid validation errors
  const data = {
    title: a.title,
    slug: a.slug,
    category: a.category,
    author: a.author || null,
    coverImage: a.coverImage || null,
    thumbnail: a.thumbnail || null,
    subcategory: a.subcategory || null,
    tags: a.tags || null,
    ogTitle: a.ogTitle || null,
    ogDescription: a.ogDescription || null,
    ogImage: a.ogImage || null,
    excerpt: a.excerpt || null,
    content: a.content || null,
    published: true,
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : now,
  // scheduledAt intentionally omitted: do not write columns that may be missing in the dev DB
  // coverAlt/thumbnailAlt removed: avoid writing DB columns that may be missing in the dev DB
    pinned: !!a.pinned,
    pinnedAt: a.pinned ? new Date() : null
  }
  // Prisma upsert requires where by unique field (slug)
  const createdOrUpdated = await prisma.article.upsert({
    where: { slug },
    update: data,
    create: data,
  })
  // create a version entry for history
  try{
    await prisma.articleVersion.create({ data: { articleId: createdOrUpdated.id, title: createdOrUpdated.title, excerpt: createdOrUpdated.excerpt || null, content: createdOrUpdated.content || '', data: { createdAt: createdOrUpdated.createdAt } } })
  }catch(e){ /* ignore */ }
  return createdOrUpdated
}


async function main(){
  const now = new Date().toISOString()
  const articles = [
    {
      title: 'Regulators Turn to High-Tech Tools to Fight AI-Driven Crypto Scams',
      slug: 'regulators-ai-scams',
      category: 'News',
      subcategory: 'latest',
      author: 'Cointist',
      authorTitle: 'Cointist Desk',
      excerpt: 'Regulators are deploying AI, blockchain analytics and cross-border cooperation to detect and disrupt AI-powered crypto fraud.',
      coverImage: '/assets/news-exchange.webp',
      thumbnail: '/assets/news-exchange.webp',
      tags: ['regulation','security','ai'],
      content: `<article>
  <h2>Regulators Turn to High-Tech Tools to Fight AI-Driven Crypto Scams</h2>
  <p>As generative AI and automation make scams faster and more convincing, regulators are updating their toolkits. Instead of relying only on manual enforcement, authorities are adopting AI-driven detection, enhanced blockchain analytics, and international information-sharing arrangements to spot and disrupt illicit activity at scale.</p>

  <h3>Detection at scale</h3>
  <p>Modern detection pipelines combine supervised machine learning with heuristics tailored to blockchain behavior. Models are trained on labeled incidents — phishing campaigns, pump-and-dump coordination, rug-pull token launches — and then used to flag anomalous wallet patterns and rapid token movements. Layering on-chain graph analytics lets investigators trace funds across bridges and mixers, while natural language classifiers surface coordinated social amplification and AI-generated content that impersonates trusted accounts.</p>

  <h3>Collaboration is key</h3>
  <p>Public-private partnerships are central to operational success. Exchanges and analytics vendors contribute telemetry and labeled event data that help train detection models, while regulators provide enforcement mechanisms and legal authority. This collaboration shortens the window between detection and action — for example, freezing deposit rails tied to a scam or issuing emergency takedown notices for malicious domains and smart contracts.</p>

  <h3>Practical challenges</h3>
  <p>Despite progress, several obstacles remain. Bad actors use increasingly sophisticated obfuscation: cross-chain bridges, transient domains, privacy-preserving mixers, and decentralized social channels. AI-generated content complicates attribution, as models can produce multilingual phishing messages that scale instantly. Detection systems must therefore balance sensitivity and false positives to avoid disrupting legitimate activity.</p>

  <h3>Policy and safeguards</h3>
  <p>Policymakers are responding with a mix of stronger KYC/AML expectations, clearer rules around token listings, and frameworks that encourage information sharing across jurisdictions. At the same time, regulators must be mindful of civil liberties and ensure detection tools have transparency, auditability, and proper human review to prevent wrongful takedowns.</p>

  <h3>What firms should do</h3>
  <p>Market participants can mitigate risk by implementing layered defenses: reputable custody solutions, multi-signature controls, pre-launch audits, and real-time transaction monitoring. Firms should also invest in IR playbooks and coordinate with analytics providers to stay ahead of evolving scam techniques. While regulators race to keep pace, proactive defenses remain the most reliable shield for businesses and consumers.</p>
</article>` ,
      publishedAt: now,
    },
    {
      title: "Ethereum's Momentum Brings Practical Gains for Small Businesses",
      slug: 'ethereum-small-businesses',
      category: 'News',
      subcategory: 'latest',
      author: 'Cointist',
      authorTitle: 'Cointist Desk',
      excerpt: 'Layer 2 scaling, cheaper fees and better tooling are enabling practical Ethereum use cases for small merchants and service providers.',
      coverImage: '/assets/news-coldstorage.webp',
      thumbnail: '/assets/news-coldstorage.webp',
      tags: ['ethereum','adoption','layer2'],
      content: `<article>
  <h2>Ethereum’s Momentum Brings Practical Gains for Small Businesses</h2>
  <p>As Ethereum’s ecosystem matures and scaling improvements lower friction, an increasing number of small businesses are finding practical, revenue-enhancing use cases on the network. From payments and loyalty programs to tokenized services and simpler contracts, the platform’s Layer 2 expansion and developer tools are turning theoretical promises into real-world applications.</p>

  <h3>Scaling unlocks payments</h3>
  <p>Key factors driving adoption include faster settlement on Layer 2s, cheaper transaction fees, and more accessible developer tooling. Businesses that once balked at high gas costs can now deploy stable-payment rails using optimistic rollups and zk-rollups, enabling near-instant settlement on microtransactions and subscription billing. Payment processors integrating L2 rails offer merchants predictable pricing and simplified UX, letting customers pay in crypto with minimal volatility exposure.</p>

  <h3>New loyalty models</h3>
  <p>Tokenized rewards and NFT-based memberships allow small merchants to create sticky incentives that are transferable and verifiable on-chain. For service businesses, simple smart contracts automate milestone payments and escrow, reducing disputes and administrative overhead. Meanwhile, open-source templates and audit services lower the technical barrier for building reliable contracts.</p>

  <h3>Operational caveats</h3>
  <p>Businesses must still manage volatility exposure, UX complexity for non-crypto-savvy customers, and regulatory compliance. Practical mitigations include instant fiat settlement rails, custodial wallets with familiar onboarding flows, and compliant token issuance aligned with local law. Accounting and tax tools are also evolving to help small businesses report crypto activity accurately.</p>

  <h3>Bottom line</h3>
  <p>Ethereum’s nearer-term value for small businesses is not speculative token gains but improved efficiency and new customer-engagement models. As the network’s scaling stack and regulatory clarity advance, expect a wave of pragmatic pilots — local retailers, subscription services, and B2B suppliers — that convert blockchain features into measurable business outcomes.</p>
</article>` ,
      publishedAt: now,
    },
    {
      title: 'AI + Smart Contracts: Legal Risks and What Businesses Should Do',
      slug: 'ai-smart-contracts-legal',
      category: 'News',
      subcategory: 'latest',
      author: 'Cointist',
      authorTitle: 'Cointist Desk',
      excerpt: 'The combination of AI and smart contracts creates legal complexity around liability, enforceability and compliance.',
      coverImage: '/assets/news-btc-hashrate.webp',
      thumbnail: '/assets/news-btc-hashrate.webp',
      tags: ['ai','legal','smart-contracts'],
      content: `<article>
  <h2>AI + Smart Contracts: Legal Risks and What Businesses Should Do</h2>
  <p>The intersection of artificial intelligence and smart contracts introduces powerful automation but also raises complex legal questions. When AI systems generate contract terms, trigger actions, or feed oracles that drive on-chain execution, issues of liability, enforceability, intellectual property, and regulatory compliance come sharply into focus.</p>

  <h3>Contract formation and intent</h3>
  <p>Traditional contract law hinges on intent, offer, and acceptance. When a model autonomously crafts terms or executes actions, courts will need to determine whether the parties intended to be bound and whether the automated outputs meet the legal standard for a contract. Parties can reduce ambiguity by drafting umbrella agreements that define how AI-generated artifacts should be interpreted and what constitutes final acceptance.</p>

  <h3>Liability and fault allocation</h3>
  <p>If an AI-driven oracle provides faulty data that triggers a large on-chain transfer, who bears responsibility? Reasonable allocation of risk through contractual warranties, indemnities, and robust error-handling clauses is vital. Businesses should maintain logs, version controls, and human-in-the-loop checkpoints for high-value flows.</p>

  <h3>IP, provenance and licensing</h3>
  <p>Using third-party models without proper licensing can expose a project to infringement claims. If models are trained on proprietary datasets, outputs may carry rights or confidentiality obligations. Clear licensing, provenance records, and data governance policies are essential defensive measures.</p>

  <h3>Regulatory compliance</h3>
  <p>Anti-money laundering, consumer protection and securities law can apply depending on how automated tokens or financial instruments operate. Engage legal counsel early, perform risk assessments, and consider independent audits of both smart contracts and the AI systems that influence them.</p>

  <h3>Practical steps</h3>
  <p>Recommended steps include: formalize governance playbooks with human override procedures; draft explicit contractual frameworks allocating risk and specifying oracle behavior; adopt comprehensive logging and explainability where possible; and secure regular audits and insurance coverage for systemic risks. These measures create operational and legal guardrails for innovation at the AI–smart-contract frontier.</p>
</article>` ,
      publishedAt: now,
    },
    {
      title: 'Macro Fears and Sky-High Crypto Forecasts: Parsing the Narrative',
      slug: 'macro-crypto-forecasts',
      category: 'News',
      subcategory: 'latest',
      author: 'Cointist',
      authorTitle: 'Cointist Desk',
      excerpt: 'Macro uncertainty fuels optimistic crypto forecasts, but converting macro stress into sustainable price gains depends on liquidity, regulation and market structure.',
      coverImage: '/assets/news-exchange.webp',
      thumbnail: '/assets/news-exchange.webp',
      tags: ['macro','bitcoin','markets'],
      content: `<article>
  <h2>Macro Fears and Sky-High Crypto Forecasts: Parsing the Narrative</h2>
  <p>Recent headlines predicting extreme crypto rallies amid fears of a collapsing fiat dollar reflect a familiar dynamic: macro uncertainty amplifies speculative narratives. While an erosion of confidence in major currencies would likely push some capital into alternative stores of value, the path from broad macro stress to specific multi-hundred-percent gains is neither direct nor guaranteed.</p>

  <h3>What drives the macro-to-crypto flow?</h3>
  <p>Macro scenarios that drive interest in crypto include persistent inflation, severe fiscal strain, or dramatic shifts in monetary policy that reduce fiat purchasing power. However, the mechanism that converts macro pressure into price increases depends on regulatory responses, on- and off-ramp liquidity, institutional flows, and whether crypto markets remain accessible and trusted during systemic stress.</p>

  <h3>The role of institutions</h3>
  <p>Institutional participation can amplify moves. Large funds and ETFs can channel significant capital quickly; a reallocation by pensions or sovereign funds could materially affect prices. Yet institutional flows also bring scrutiny, compliance demands, and potential sell-side liquidity during stress. Crypto markets’ structure — with leverage, concentrated venues, and cross-border bridges — can create outsized volatility rather than stable appreciation.</p>

  <h3>Interpreting bold price targets</h3>
  <p>Analysts who cite astronomical price targets often blend macro thesis with optimistic adoption curves and simplistic supply assumptions. A prudent interpretation separates the macro catalyst from execution risk. Investors should weigh how readily they can convert fiat to crypto and back, what custody protections exist, and how robust the legal framework is in their jurisdiction.</p>

  <h3>Practical risk management</h3>
  <p>Risk management matters more than headline-grabbing forecasts. Diversification, position sizing, stop-loss discipline, and an explicit liquidity plan are practical defenses. For institutions and retail investors alike, the reasonable approach is to monitor macro indicators, stress-test portfolios for extreme outcomes, and avoid treating any single forecast as certainty.</p>
</article>` ,
      publishedAt: now,
    }
  ]

  try{
    for (const a of articles){
      console.error('Upserting:', a.slug)
      const res = await upsertArticle(a)
      console.log('->', res.id, res.slug)
    }
    console.log('Done')
  }catch(e){
    console.error('Error', e)
  }finally{
    await prisma.$disconnect()
  }
}

main()
