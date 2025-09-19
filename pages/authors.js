import React from 'react'
import SiteFooter from '../src/components/SiteFooter'
import SEO from '../src/components/SEO'

export default function Authors(){
  return (
    <>
      <SEO
        url={'/authors'}
        title="Authors  Cointist"
        description="Meet the Cointist editorial team: reporters, analysts, and editors who produce news, analysis, and guides."
        primaryKeyword="Cointist authors"
        keywords={["Cointist","authors","crypto journalists","crypto news"]}
      />
      <main>
      <div className="wrap">
        <header>
          <h1>Cointist Author Directory</h1>
          <p>Meet the editors and reporters behind our opinion pieces, protocol deep-dives, policy explainers, and in-depth analyses.</p>
        </header>
        <h2 id="oped" class="section-title">Op-Ed (Analysis & Commentary)</h2>

        <section className="grid" aria-label="Author cards">

          <article className="card">
            <a href="/authors#ayesha-rahman" aria-label="Author: Ayesha Rahman">
              <img className="avatar" src="/authors/ayesha.webp" alt="Ayesha Rahman" />
            </a>
            <div>
              <h3>Ayesha Rahman</h3>
              <div className="region">South Asia — Pakistan</div>
              <p className="byline">Ex-fintech product manager who now reports on the real-world impact of crypto rails in emerging markets. Ayesha blends user research with data on flows to explain how stablecoins and DeFi are reshaping remittances, gig payouts, and merchant acceptance. She’s known for field interviews and crisp, policy-aware explainers that connect ground truth to global trends.</p>
              <ul className="beats">
                <li>On-chain remittances</li><li>Stablecoins (APAC/MEA)</li><li>Regulatory sandboxes</li>
              </ul>
              <a className="link" href="#ayesha-rahman">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#arjun-mehta" aria-label="Author: Arjun Mehta">
              <img className="avatar" src="/authors/arjun.webp" alt="Arjun Mehta" />
            </a>
            <div>
              <h3>Arjun Mehta</h3>
              <div className="region">South Asia — India</div>
              <p className="byline">Quant-minded writer translating dense token models, L2 architectures, and staking mechanics into practical takeaways. Arjun stress-tests narratives with simple math, reproducible charts, and clear assumptions—so founders, investors, and power users can see what really drives value accrual.</p>
              <ul className="beats">
                <li>Token design</li><li>L2s &amp; ZK</li><li>Staking &amp; MEV</li>
              </ul>
              <a className="link" href="#arjun-mehta">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#nila-perera" aria-label="Author: Nila Perera">
              <img className="avatar" src="/authors/nila.webp" alt="Nila Perera" />
            </a>
            <div>
              <h3>Nila Perera</h3>
              <div className="region">South Asia — Sri Lanka</div>
              <p className="byline">Former FX and macro reporter covering the intersection of crypto with rates, risk, and liquidity. Nila dissects derivatives positioning, ETF flows, and volatility regimes to explain why crypto sometimes trades like a tech stock—and when it doesn’t.</p>
              <ul className="beats">
                <li>BTC/ETH macro</li><li>ETFs</li><li>Vol &amp; mining economics</li>
              </ul>
              <a className="link" href="#nila-perera">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#hana-sato" aria-label="Author: Hana Sato">
              <img className="avatar" src="/authors/Hana.webp" alt="Hana Sato" />
            </a>
            <div>
              <h3>Hana Sato</h3>
              <div className="region">Asia — Japan</div>
              <p className="byline">Web3 product designer documenting wallet UX and consumer app design across Asia. Hana runs hands-on teardowns, highlights onboarding drop-offs, and surfaces small UI wins that compound adoption. Expect frameworks teams can ship tomorrow, not hand-wavy trend talk.</p>
              <ul className="beats">
                <li>Wallet UX</li><li>NFTs &amp; gaming</li><li>Consumer adoption</li>
              </ul>
              <a className="link" href="#hana-sato">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#minh-nguyen" aria-label="Author: Minh Nguyen">
              <img className="avatar" src="/authors/minh.webp" alt="Minh Nguyen" />
            </a>
            <div>
              <h3>Minh Nguyen</h3>
              <div className="region">Asia — Vietnam</div>
              <p className="byline">Security researcher covering exploit anatomy, incident response, and preventative tooling. Minh’s post-mortems prioritize root causes, code snippets, and playbooks teams can adopt—written so both engineers and non-technical stakeholders can act on them.</p>
              <ul className="beats">
                <li>Audits</li><li>Bridge hacks</li><li>Security best practices</li>
              </ul>
              <a className="link" href="#minh-nguyen">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#camila-duarte" aria-label="Author: Camila Duarte">
              <img className="avatar" src="/authors/camila.webp" alt="Camila Duarte" />
            </a>
            <div>
              <h3>Camila Duarte</h3>
              <div className="region">South America — Brazil</div>
              <p className="byline">DeFi analyst tracking liquidity, perps/DEX market structure, and the rise of real-world assets in Latin America. Camila blends on-chain data with field reporting to map how institutions and fintechs are quietly adopting crypto rails behind the headlines.</p>
              <ul className="beats">
                <li>DEXs &amp; perps</li><li>RWA</li><li>TVL analytics</li>
              </ul>
              <a className="link" href="#camila-duarte">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#santiago-alvarez" aria-label="Author: Santiago Álvarez">
              <img className="avatar" src="/authors/santiago.webp" alt="Santiago Álvarez" />
            </a>
            <div>
              <h3>Santiago Álvarez</h3>
              <div className="region">South America — Argentina</div>
              <p className="byline">Bitcoin historian focused on culture, mining, and self-custody in high-inflation economies. Santiago’s reporting pairs oral histories with hard data, capturing why Bitcoin matters to merchants, miners, and families—not just markets.</p>
              <ul className="beats">
                <li>Mining</li><li>Lightning</li><li>Inflation &amp; macro</li>
              </ul>
              <a className="link" href="#santiago-alvarez">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#emilia-nowak" aria-label="Author: Emilia Nowak">
              <img className="avatar" src="/authors/Emilia.webp" alt="Emilia Nowak" />
            </a>
            <div>
              <h3>Emilia Nowak</h3>
              <div className="region">Europe — Poland</div>
              <p className="byline">Policy correspondent translating EU rulemaking into checklists founders can use. Emilia distills MiCA, AML, and licensing regimes with citations and practical edge-cases, helping teams avoid surprises during authorization and launch.</p>
              <ul className="beats">
                <li>MiCA/AML</li><li>Licensing</li><li>Compliance toolkits</li>
              </ul>
              <a className="link" href="#emilia-nowak">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#luca-de-santis" aria-label="Author: Luca De Santis">
              <img className="avatar" src="/authors/luca.webp" alt="Luca De Santis" />
            </a>
            <div>
              <h3>Luca De Santis</h3>
              <div className="region">Europe — Italy</div>
              <p className="byline">Infrastructure reporter covering validators, clients, data availability layers, and the “plumbing” that keeps chains alive. Luca writes for builders, but stays readable—mapping trade-offs between performance, reliability, and decentralization.</p>
              <ul className="beats">
                <li>Clients &amp; nodes</li><li>Restaking/AVSs</li><li>DA &amp; rollup infra</li>
              </ul>
              <a className="link" href="#luca-de-santis">Read profile ↓</a>
            </div>
          </article>

          <article className="card">
            <a href="/authors#freja-lindholm" aria-label="Author: Freja Lindholm">
              <img className="avatar" src="/authors/freja.webp" alt="Freja Lindholm" />
            </a>
            <div>
              <h3>Freja Lindholm</h3>
              <div className="region">Europe — Sweden</div>
              <p className="byline">Energy and sustainability reporter exploring mining footprints, grid integration, and the economics of renewables. Freja focuses on measurable impacts and grid-balancing case studies, separating marketing spin from verifiable outcomes.</p>
              <ul className="beats">
                <li>Energy markets</li><li>ESG disclosures</li><li>Mining technology</li>
              </ul>
              <a className="link" href="#freja-lindholm">Read profile ↓</a>
            </div>
          </article>

        </section>

         <h2 id="news" class="section-title">News Desk (Breaking & Markets)</h2>
    <section class="grid" aria-label="News Desk">
  <article class="card"><img class="avatar" src="/authors/orig/zara.webp" alt="Zara Rauf" /><div><span class="role-pill">Breaking News</span><h3>Zara Rauf</h3><div class="region">South Asia — Pakistan</div>
        <p class="byline">Real-time markets reporter focused on BTC/ETH, ETF flows, and funding/OI. Files fast, confirms rigorously, and updates live posts as facts evolve.</p>
        <ul class="beats"><li>BTC/ETH moves</li><li>ETF flows</li><li>Derivatives tape</li></ul>
        <a class="link" href="#zara-rauf">Read profile ↓</a></div></article>

  <article class="card"><img class="avatar" src="/authors/orig/rohan.webp" alt="Rohan Khanna" /><div><span class="role-pill">Markets</span><h3>Rohan Khanna</h3><div class="region">South Asia — India</div>
        <p class="byline">Macro-aware daily briefs tying crypto to rates, DXY, and risk appetite. One-screen reads for open/close handovers.</p>
        <ul class="beats"><li>Daily briefs</li><li>FX & rates</li><li>Open/close recaps</li></ul>
        <a class="link" href="#rohan-khanna">Read profile ↓</a></div></article>

  <article class="card"><img class="avatar" src="/authors/orig/Kai Yamamot.png" alt="Kai Yamamoto" /><div><span class="role-pill">Breaking News</span><h3>Kai Yamamoto</h3><div class="region">Asia — Japan</div>
        <p class="byline">APAC incident coverage—exchange outages, sequencer pauses, bridge advisories—with verifiable source links and status pages.</p>
        <ul class="beats"><li>Exchange status</li><li>Outages/incidents</li><li>APAC live updates</li></ul>
        <a class="link" href="#kai-yamamoto">Read profile ↓</a></div></article>

  <article class="card"><img class="avatar" src="/authors/orig/marta.webp" alt="Marta Silva" /><div><span class="role-pill">Markets</span><h3>Marta Silva</h3><div class="region">Europe — Portugal</div>
        <p class="byline">EU session wraps blending policy headlines, flows, and crypto-equity proxies to set the U.S. open.</p>
        <ul class="beats"><li>EU session</li><li>Policy headlines</li><li>Crypto equities</li></ul>
        <a class="link" href="#marta-silva">Read profile ↓</a></div></article>

  <article class="card"><img class="avatar" src="/authors/orig/Tomasz.webp" alt="Tomasz Mazur" /><div><span class="role-pill">Markets</span><h3>Tomasz Mazur</h3><div class="region">Europe — Poland</div>
        <p class="byline">Turns funding, basis, and options skew into transparent, reproducible signals for traders.</p>
        <ul class="beats"><li>Funding/basis</li><li>Options skew</li><li>Volume anomalies</li></ul>
        <a class="link" href="#tomasz-mazur">Read profile ↓</a></div></article>

  <article class="card"><img class="avatar" src="/authors/orig/Luz.webp" alt="Luz Valdés" /><div><span class="role-pill">Breaking News</span><h3>Luz Valdés</h3><div class="region">South America — Chile</div>
        <p class="byline">LatAm filings, listings, and outages—bilingual sourcing and document excerpts for instant verification.</p>
        <ul class="beats"><li>Regulatory filings</li><li>Exchange news</li><li>Mining developments</li></ul>
        <a class="link" href="#luz-valdes">Read profile ↓</a></div></article>
    </section>


        <section className="profiles" aria-label="Detailed author profiles">
          <article id="ayesha-rahman" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Ayesha Rahman</h2>
                <p className="sub">South Asia — Pakistan · On-chain remittances, stablecoins, regulatory sandboxes</p>
              </div>
              <a href="/authors#ayesha-rahman" aria-label="Author profile: Ayesha Rahman">
                <img className="profileImg" src="/authors/orig/ayesha.webp" alt="Ayesha Rahman" />
              </a>
            </div>
            <p className="lead">Ayesha spent years shipping fintech products for cross-border payouts before switching to journalism. She covers how families, freelancers, and SMEs adopt crypto rails in places where banking is slow or expensive. Her work combines ground interviews with flows data and policy analysis, clarifying what “financial inclusion” looks like when stablecoins meet mobile money and agent networks.</p>
            <ul className="articles">
              <li><a href="#">Stablecoins as the New Western Union: Inside Pakistan’s Remittance Shift</a></li>
              <li><a href="#">The Last Mile Problem: Cash-Out Networks for On-Chain Money</a></li>
              <li><a href="#">CBDCs vs. USDT: What Emerging Markets Are Actually Choosing</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="arjun-mehta" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Arjun Mehta</h2>
                <p className="sub">South Asia — India · Token design, L2s/ZK, staking & MEV</p>
              </div>
              <a href="/authors#arjun-mehta" aria-label="Author profile: Arjun Mehta">
                <img className="profileImg" src="/authors/orig/arjun.webp" alt="Arjun Mehta" />
              </a>
            </div>
            <p className="lead">Arjun breaks apart token designs and L2 architectures with reproducible math. He focuses on what accrues value, what dilutes it, and how validator and sequencer incentives shape outcomes. Expect clear models, transparent assumptions, and charts teams can re-create to test their own scenarios.</p>
            <ul className="articles">
              <li><a href="#">L2 Wars: Why Rollups Are the Real Ethereum Killer App</a></li>
              <li><a href="#">The Hidden Economics of MEV: Winners and Losers</a></li>
              <li><a href="#">Staking, Restaking, and Risk: A Practical Framework</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="nila-perera" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Nila Perera</h2>
                <p className="sub">South Asia — Sri Lanka · BTC/ETH macro, ETFs, volatility & mining</p>
              </div>
              <a href="/authors#nila-perera" aria-label="Author profile: Nila Perera">
                <img className="profileImg" src="/authors/orig/nila.webp" alt="Nila Perera" />
              </a>
            </div>
            <p className="lead">Nila covers crypto through a markets lens—rates, liquidity, and positioning. She reads ETF flows and derivatives curves alongside miner behavior to explain impulse and trend. Her pieces bridge the gap between macro tourists and crypto-native traders.</p>
            <ul className="articles">
              <li><a href="#">Bitcoin Above The Fold: Macro Hedge or Risk Asset in Disguise?</a></li>
              <li><a href="#">ETF Flows Tell Us More About TradFi Than Crypto</a></li>
              <li><a href="#">Vol Windows: Why Funding, OI, and Skew Still Matter</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="hana-sato" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Hana Sato</h2>
                <p className="sub">Asia — Japan · Wallet UX, NFTs &amp; gaming, consumer adoption</p>
              </div>
              <a href="/authors#hana-sato" aria-label="Author profile: Hana Sato">
                <img className="profileImg" src="/authors/orig/Hana.webp" alt="Hana Sato" />
              </a>
            </div>
            <p className="lead">Hana evaluates crypto apps by their smallest details—seed flows, fee clarity, empty-state design, and recovery UX. She publishes teardown notes and heuristics that product teams can adopt immediately, with special attention to Asia’s gaming-led adoption.</p>
            <ul className="articles">
              <li><a href="#">Wallets Need Feelings: Designing for Fear, Relief, and Trust</a></li>
              <li><a href="#">Japan’s NFT Gamer: Onboarding Without the Lecture</a></li>
              <li><a href="#">UX Debt in DeFi: Five Fixes That Ship This Sprint</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="minh-nguyen" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Minh Nguyen</h2>
                <p className="sub">Asia — Vietnam · Audits, bridge hacks, security best practices</p>
              </div>
              <a href="/authors#minh-nguyen" aria-label="Author profile: Minh Nguyen">
                <img className="profileImg" src="/authors/orig/minh.webp" alt="Minh Nguyen" />
              </a>
            </div>
            <p className="lead">Minh writes for teams that have to defend production systems. His incident reports focus on root causes and remediation, not sensationalism. He maintains a pattern library of common exploit vectors and practical checklists for prevention and response.</p>
            <ul className="articles">
              <li><a href="#">Inside the Bridge Hack: Anatomy of a $600M Exploit</a></li>
              <li><a href="#">Culture Over Code: Why Security Fails Long Before Launch</a></li>
              <li><a href="#">From Post-Mortem to Playbook: Turning Pain Into Process</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="camila-duarte" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Camila Duarte</h2>
                <p className="sub">South America — Brazil · DEXs/perps, RWA, TVL analytics</p>
              </div>
              <a href="/authors#camila-duarte" aria-label="Author profile: Camila Duarte">
                <img className="profileImg" src="/authors/orig/camila.webp" alt="Camila Duarte" />
              </a>
            </div>
            <p className="lead">Camila tracks how liquidity moves—between venues, chains, and new RWA primitives. She pairs on-chain data with interviews across Brazil’s fintech and exchange ecosystem, mapping incentives that quietly drive adoption ahead of the headlines.</p>
            <ul className="articles">
              <li><a href="#">From Soybeans to Stablecoins: RWAs in Brazil</a></li>
              <li><a href="#">DEX Liquidity Wars: Where the Next Basis Point Comes From</a></li>
              <li><a href="#">LatAm’s Quiet On-Ramp: Fintechs Embracing Crypto Rails</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="santiago-alvarez" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Santiago Álvarez</h2>
                <p className="sub">South America — Argentina · Mining, Lightning, inflation &amp; macro</p>
              </div>
              <a href="/authors#santiago-alvarez" aria-label="Author profile: Santiago Álvarez">
                <img className="profileImg" src="/authors/orig/santiago.webp" alt="Santiago Álvarez" />
              </a>
            </div>
            <p className="lead">Santiago’s beat is lived experience: miners negotiating energy, merchants surviving inflation, and families choosing self-custody. He blends narrative with data to show how Bitcoin functions off-exchange and off-Twitter.</p>
            <ul className="articles">
              <li><a href="#">Argentina’s Bitcoin Playbook: Surviving Inflation with Lightning</a></li>
              <li><a href="#">Beyond Profit: Mining as Local Industry</a></li>
              <li><a href="#">Self-Custody in the Wild: What Actually Works</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="emilia-nowak" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Emilia Nowak</h2>
                <p className="sub">Europe — Poland · MiCA/AML, licensing, compliance toolkits</p>
              </div>
              <a href="/authors#emilia-nowak" aria-label="Author profile: Emilia Nowak">
                <img className="profileImg" src="/authors/orig/Emilia.webp" alt="Emilia Nowak" />
              </a>
            </div>
            <p className="lead">Emilia translates EU regulation into operations. Her work unpacks definitions, thresholds, and gray areas founders miss—paired with examples from real authorization journeys. Expect citations, checklists, and timelines teams can adopt.</p>
            <ul className="articles">
              <li><a href="#">MiCA in Practice: What Founders Need to Know Now</a></li>
              <li><a href="#">AML Without the Drama: Building a Compliant Flow</a></li>
              <li><a href="#">Passporting Playbook: From Local License to EU Scale</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="luca-de-santis" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Luca De Santis</h2>
                <p className="sub">Europe — Italy · Clients/nodes, restaking/AVSs, DA &amp; rollup infra</p>
              </div>
              <a href="/authors#luca-de-santis" aria-label="Author profile: Luca De Santis">
                <img className="profileImg" src="/authors/orig/luca.webp" alt="Luca De Santis" />
              </a>
            </div>
            <p className="lead">Luca reports on the hidden machinery of blockchains. He compares client diversity, failure modes, and operator economics—clarifying where performance gains come from and what they cost in decentralization and resilience.</p>
            <ul className="articles">
              <li><a href="#">The Validator Economy: Why Staking Is Becoming Industrial</a></li>
              <li><a href="#">Restaking: Infrastructure Innovation or New Attack Vector?</a></li>
              <li><a href="#">Data Availability Wars: The New Scaling Frontier</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

          <article id="freja-lindholm" className="profile">
            <div className="profileHeader">
              <div className="profileMeta">
                <h2>Freja Lindholm</h2>
                <p className="sub">Europe — Sweden · Energy markets, ESG, mining technology</p>
              </div>
              <a href="/authors#freja-lindholm" aria-label="Author profile: Freja Lindholm">
                <img className="profileImg" src="/authors/orig/freja.webp" alt="Freja Lindholm" />
              </a>
            </div>
            <p className="lead">Freja focuses on measurable energy impacts: curtailment usage, grid services, and renewable integration. Her case studies weigh claims against data and regulation, helping readers see when mining is a liability—and when it’s a grid asset.</p>
            <ul className="articles">
              <li><a href="#">The ESG Debate: Can Bitcoin Mining Be Net-Positive for Grids?</a></li>
              <li><a href="#">Nordic Hydro + Crypto: A Clean Mining Case Study</a></li>
              <li><a href="#">Demand Response 101: Mining as a Flexible Load</a></li>
            </ul>
            <a className="backtop" href="#">Back to top ↑</a>
          </article>

        </section>
      </div>
      </main>
      <SiteFooter />
    </>
  )
}
