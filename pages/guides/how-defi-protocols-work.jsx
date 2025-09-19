import React from 'react'
import Head from 'next/head'
import GuideLayout from '../../components/GuideLayout'
import SiteFooter from '../../src/components/SiteFooter'
import SEO from '../../src/components/SEO'

export default function HowDeFiProtocolsWork(){
  const jsonLd = {
    "@context":"https://schema.org",
    "@type":"Article",
    "headline":"How DeFi Protocols Power Trading, Lending & Perps (Explained)",
    "about":["DeFi","AMM","Lending","Perpetual Futures"],
    "author":{"@type":"Organization","name":"Cointist"},
    "publisher":{"@type":"Organization","name":"Cointist","logo":{"@type":"ImageObject","url":"https://cointist.net/assets/logo.png"}},
    "datePublished":"2025-08-28",
    "dateModified":"2025-08-28",
    "image":"https://cointist.net/assets/guides/og-defi-how-it-works.jpg"
  }

  return (

    <>
    <GuideLayout
      title="How DeFi Protocols Power Trading, Lending & Perps (Explained)"
      crumbs={[ { href: '/education', label: 'Education / ' }, { href: '/education/defi', label: 'DeFi' } ]}
      heroImage="/assets/guides/hero-wallet-network.webp"
      author={{ avatar: '/assets/author-avatar.webp', name: 'Cointist Editorial', role: 'Editorial Team' }}
      category="DeFi"
      lastUpdated="Aug 28, 2025"
    >
  <SEO title="How DeFi Protocols Power Trading, Lending & Perps  Cointist Guides" description="Understand how AMMs, lending markets, and perpetual futures work in DeFi. Learn about constant product pricing, liquidations, funding rates, and composability." image={"https://cointist.net/assets/guides/og-defi-how-it-works.jpg"} canonical={"https://cointist.net/guides/how-defi-protocols-work"} primaryKeyword={"DeFi protocols"} keywords={["DeFi","AMM","lending","perpetual futures"]} author={{ name: 'Cointist Editorial' }} datePublished={"2025-08-28"} dateModified={"2025-08-28"} />

  <h2 id="amms">Automated Market Makers (AMMs)</h2>
      <p>Instead of order books, AMMs use liquidity pools. Liquidity providers deposit two assets; traders swap against the pool.</p>
      <p className="formula"><strong>x · y = k</strong></p>
      <p>This constant-product formula (Uniswap v2) ensures pool balance. Big trades shift the ratio, creating slippage.</p>
      <div className="callout"><strong>Impermanent loss:</strong> LPs may earn fees but lose vs. HODL if relative prices shift. Correlated pairs (e.g., stablecoins) reduce IL.</div>

      <div className="divider"></div>

      <h2 id="lending">Lending Protocols</h2>
      <p>Depositors earn interest; borrowers post collateral. Health factors track solvency. Oracles supply asset prices; if collateral value falls, bots liquidate.</p>
      <div className="table">
        <table>
          <thead><tr><th>Key Term</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>Utilization</td><td>Borrowed ÷ Supplied; drives rate curves</td></tr>
            <tr><td>Oracle</td><td>On-chain price feed (Chainlink, TWAPs)</td></tr>
            <tr><td>Liquidation</td><td>When health &lt; threshold; bot repays debt, seizes collateral</td></tr>
          </tbody>
        </table>
      </div>

      <div className="divider"></div>

      <h2 id="perps">Perpetual Futures (“Perps”)</h2>
      <p>Perps mimic futures without expiry. A funding rate mechanism keeps perp price close to index: if perp trades above, longs pay shorts (positive funding).</p>
      <ul>
        <li><strong>Margins:</strong> Initial vs. maintenance requirements</li>
        <li><strong>Insurance funds:</strong> Backstops for losses</li>
        <li><strong>OI &amp; skew:</strong> Show positioning/risk</li>
      </ul>

      <div className="divider"></div>

      <h2 id="composability">Composability</h2>
      <p>Protocols stack: LP tokens collateralize loans, yield vaults auto-compound, perps hedge LP exposure. This “money Lego” property enables rapid innovation—but also contagion risk.</p>

      
    </GuideLayout>
    <SiteFooter />
    </>
  )

}
