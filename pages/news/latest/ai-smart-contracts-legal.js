import React from 'react'
import Head from 'next/head'
import SEO from '../../../src/components/SEO'
import MarketMarquee from '../../../src/components/MarketMarquee'
import SiteFooter from '../../../src/components/SiteFooter'
import ArticleLayout from '../../../src/components/ArticleLayout'

export async function getServerSideProps(){
  const article = {
    id: 'cointist-ai-smart-contracts-legal',
    title: 'AI + Smart Contracts: Legal Risks and What Businesses Should Do',
    excerpt: 'The combination of AI and smart contracts creates legal complexity around liability, enforceability and compliance.',
    slug: 'ai-smart-contracts-legal',
    category: 'News',
    subcategory: 'latest',
    author: 'Cointist',
    authorTitle: 'Cointist Desk',
    publishedAt: new Date().toISOString(),
    coverImage: '/assets/news-btc-hashrate.webp',
    thumbnail: '/assets/news-btc-hashrate.webp',
    tags: ['ai','legal','smart-contracts'],
    content: `
<article>
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
</article>
`
  }
  return { props: { article } }
}

export default function Page({ article }){
  return (
    <>
      <SEO
        title={article.ogTitle || article.title}
        description={article.ogDescription || article.excerpt}
        image={article.ogImage || article.coverImage}
  canonical={article.slug ? (process.env.SITE_URL || 'https://cointist.net') + `/news/latest/${encodeURIComponent(article.slug)}` : undefined}
        url={article.slug ? `/news/latest/${encodeURIComponent(article.slug)}` : undefined}
  author={article.author || article.authorName || article.author_name}
  datePublished={article.publishedAt || article.published_at || article.published || article.createdAt}
  dateModified={article.updatedAt || article.updated_at || article.modifiedAt || article.dateModified}
      />
      <MarketMarquee />
      <ArticleLayout article={article} />
      <SiteFooter />
    </>
  )
}
