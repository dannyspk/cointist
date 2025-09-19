import React from 'react'
import Head from 'next/head'
import SiteFooter from '../../src/components/SiteFooter'
import SEO from '../../src/components/SEO'

export default function HowDeFiProtocolsWork(){
  const jsonLd = {
    "@context":"https://schema.org",
    "@type":"Article",
    "headline":"How DeFi Protocols Work",
    "about":["DeFi","AMM","Lending","Perpetual Futures"],
    "author":{"@type":"Organization","name":"Cointist"},
    "publisher":{"@type":"Organization","name":"Cointist","logo":{"@type":"ImageObject","url":"https://cointist.net/assets/logo.png"}},
    "datePublished":"2025-08-28",
    "dateModified":"2025-08-28",
    "image":"https://cointist.net/assets/guides/og-defi-how-it-works.jpg"
  }

  return (
    <div className="guide-layout">
  <SEO title={"How DeFi Protocols Work • Cointist Guides"} description={"Understand how AMMs, lending markets, and perpetual futures work in DeFi. Learn about constant product pricing, liquidations, funding rates, and composability."} image={"https://cointist.net/assets/guides/og-defi-how-it-works.jpg"} canonical={"https://cointist.net/guides/how-defi-protocols-work"} primaryKeyword={"DeFi protocols"} keywords={["DeFi","AMM","lending","perps"]} author={{ name: 'Cointist Editorial' }} datePublished={"2025-08-28"} dateModified={"2025-08-28"} />

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-left">
            <div className="crumbs">
              <a href="/education">Education / </a> 
              <a href="/education/defi">DeFi</a>
            </div>
            <h1>How DeFi Protocols Work?</h1>
          </div>
          <div className="meta">
        
            <div className="share" aria-label="Share">
              <div className="share-meta"></div>
              <div className="share-icons">
                <a href="#" title="Share on X" aria-label="Share on X">X</a>
                <a href="#" title="Share on LinkedIn" aria-label="Share on LinkedIn">in</a>
                <a href="#" title="Share on Reddit" aria-label="Share on Reddit">r</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hero-graphic" aria-hidden="true">
        <img src="/assets/guides/hero-wallet-network.webp" alt="Illustration: wallets connecting to a network" />
        <div className="author-box hero-author">
          <img src="/assets/author-avatar.webp" alt="Author avatar" className="author-avatar" />
          <div className="author-meta">
            <div className="author-name">Cointist Editorial</div>
            <div className="author-role">Editorial Team</div>
            <div className="author-category">DeFi</div>
            <div className="author-lastUpdated">Last updated: Aug 28, 2025</div>
          </div>
        </div>
      </div>

      <main className="wrap">
        <div className="grid">
          <div>
            <aside className="definition">
              <h3>DEFINITION</h3>
              <p><strong>Decentralized Finance (DeFi)</strong> replaces intermediaries with code. AMMs set token prices via math formulas, lending protocols manage deposits and collateral, and perpetual futures track indexes using funding rates.</p>
            </aside>

            <article>
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

              
            </article>

            <aside className="related">
              <h3>Related Guides</h3>
              <div className="chips">
                <a className="chip" href="/guides/what-is-web3">What Is Web3?</a>
                <a className="chip" href="/guides/setting-up-your-first-wallet">Setting Up Your First Wallet</a>
                <a className="chip" href="/guides/risk-in-defi">Risk in DeFi</a>
              </div>
            </aside>
          </div>

          <aside className="toc">
            <h4>On this page</h4>
            <ol>
              <li><a href="#amms">Automated Market Makers</a></li>
              <li><a href="#lending">Lending Protocols</a></li>
              <li><a href="#perps">Perpetual Futures</a></li>
              <li><a href="#composability">Composability</a></li>
            </ol>
          </aside>
        </div>
      </main>

      <section className="learn-more">
        <div className="learn-inner">
          <h3>Learn more about blockchain technology</h3>
          <div className="cards-viewport">
            <div className="cards-track" role="list">
              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/card-tokenization.webp" alt="Asset tokenization illustration" />
                </div>
                <h4>Asset Tokenization</h4>
                <p>Learn how tokenization enables new digital ownership models and unlocks liquidity for real-world assets.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/Markets.webp" alt="Market illustration" />
                </div>
                <h4>Markets</h4>
                <p>Explore on-chain marketplaces, order books, and AMM mechanics that power decentralized trading.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/bridges.webp" alt="Cross-chain illustration" />
                </div>
                <h4>Cross-Chain</h4>
                <p>See how bridges, relayers, and interoperability layers connect otherwise isolated blockchains.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/DeFi.webp" alt="DeFi illustration" />
                </div>
                <h4>DeFi</h4>
                <p>Take a deep dive into decentralized finance primitives: lending, AMMs, staking, and yield strategies.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/layer2.webp" alt="Layer 2 illustration" />
                </div>
                <h4>L2s</h4>
                <p>Understand Layer 2 scaling: rollups, optimistic vs ZK approaches, and trade-offs for cost and security.</p>
              </article>

              <article className="learn-card" role="listitem">
                <div className="card-visual" aria-hidden>
                  <img src="/assets/guides/smart-contract.webp" alt="Smart contracts illustration" />
                </div>
                <h4>Smart Contracts</h4>
                <p>Learn how programmable contracts automate rules, custody, and composable protocols on-chain.</p>
              </article>
            </div>
          </div>
          <div className="cards-nav" aria-hidden>
            <button className="cards-prev" aria-label="Scroll left">◀</button>
            <button className="cards-next" aria-label="Scroll right">▶</button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
