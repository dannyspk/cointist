const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

(async () => {
  const updates = {
    'Coinbase Strategy Bets Help Crypto Stocks Rebound as Bitcoin and Ethereum Climb': {
      author: 'Decrypt',
      excerpt: 'Shares of companies exposed to crypto markets experienced renewed buying as Bitcoin and Ethereum pushed higher, prompting investors to reassess exchange and custody-related equities in the context of improved macro sentiment and renewed retail activity.',
      content: `Institutional and retail investors have been watching the crypto sector closely as market dynamics shifted over recent sessions. Coinbase and other firms with direct exposure to trading volume, custody services, and token listings saw their equity valuations adjust in response to rising prices for Bitcoin and Ethereum. The recent price appreciation was driven in part by expectations of easier monetary policy and renewed buying in spot crypto markets, which in turn led to higher volumes on major exchanges and renewed interest in on-chain activity.

Market participants noted that when the underlying assets — BTC and ETH — rally, it often produces a welcome spillover into the public equities of companies that facilitate crypto trading, custody, or institutional access. Traders reported rotation out of risk-off positions and into names tied to fee generation from increased spot activity. Analysts highlighted several mechanisms behind the move: higher spot prices can lift sentiment, unlocking buy-side interest; institutional allocations into token-linked products can improve liquidity; and algorithmic trading desks and market-makers respond to volatility by providing more depth, generating fee income for exchanges.

Digging deeper, several structural and tactical drivers help explain why exchange and custody stocks can outperform in short windows. First, higher spot prices typically increase trading volumes and calendar spreads, which elevates transaction fees that exchanges collect. Second, periods of price appreciation often correlate with retail re-entry — casual traders who previously stayed at the sidelines due to poor risk-reward math now return, adding to order flow. Third, derivative desks and institutional traders frequently increase activity during trend changes, employing hedging and delta strategies that produce more ancillary revenue for market infrastructure providers.

That said, market watchers warn that a price-driven rally among service providers is not the same as an improvement in long-term fundamentals. Exchange margins can be compressed by competition, regulatory fines, or adverse fee changes. Custodial providers face counterparty, operational, and compliance risks that require sustained investment. Investors therefore need to distinguish between momentum-driven multiple expansion and genuine growth in revenue and cashflow. For corporate stakeholders, the critical focus should be on whether higher volumes translate into repeatable margins and whether regulatory developments create durable headwinds. Until such signals are clearer, the rebound offers an opportunistic but cautious window for those looking to rotate into crypto-related equities.`,
    },

    'Markets Rally: Bitcoin and Ethereum Jump After Fed Signals Ease': {
      author: 'Decrypt',
      excerpt: 'A dovish shift in central bank commentary prompted a rapid risk-on rotation, with major cryptocurrencies posting sharp gains as traders priced in lower rates and looser financial conditions.',
  content: `Global markets quickly responded to a more accommodative tone from central bank officials, who signaled that monetary policy may shift toward easing. The immediate market reaction favored risk assets: equities rallied, bond yields softened, and cryptocurrencies — led by Bitcoin and Ethereum — experienced significant inflows as traders repositioned portfolios.

For crypto markets specifically, the reaction function to central bank rhetoric is multifaceted. Lower real rates can make yield-generating traditional assets less attractive, prompting allocators to search for alternative stores of value or higher expected returns. Additionally, risk parity and momentum-based funds may mechanically allocate more weight to assets that demonstrate positive returns in such regimes, which amplifies inflows into larger-cap digital assets. Retail sentiment also plays a role: headlines that suggest easier policy often spur renewed social-media-driven retail participation, increasing on-chain activity and spot turnover.

The mechanics of the rally showed typical signs of a multi-participant move. Exchange order books tightened as bid-side interest absorbed selling pressure, and derivative markets absorbed many of the newly minted longs via futures and options. Data suggested that implied volatility compressed slightly even as prices rose, indicating growing comfort among some participants with the new price levels. Liquidity providers and market-makers adapted by widening spreads and deploying capital to manage inventory risks, which momentarily increased trading costs but enabled deeper execution for large blocks.

Analysts cautioned about the sustainability of such rallies, highlighting risks like leverage accumulation, sudden shifts in risk appetite if macro data surprises to the upside or downside, and the perennial regulatory overhang that can quickly dominate sentiment. Still, in the immediate aftermath of dovish comments, the narrative is straightforward: lower-for-longer rates act as a catalyst for renewed capital flows into risk assets, and crypto — as a liquid, 24/7 market — often sees those flows manifest rapidly. For traders, the priority is balancing participation with disciplined risk management to avoid being caught in swift reversals.`,
    },

    'ETF Flows Shift: Bitcoin ETFs See Outflows as Ethereum Stages a Comeback': {
      author: 'Decrypt',
      excerpt: 'ETF net flows shifted over the recent days, with investors trimming exposure to Bitcoin funds while routing capital toward Ethereum-related products amid changing market narratives.',
  content: `Exchange-traded products are one of the primary on-ramps for large, tradable exposure to cryptocurrencies, and they provide an efficient conduit for both institutional and retail capital. Over the past days, flow data revealed a noticeable rotation: Bitcoin-focused ETFs saw net outflows while Ethereum-linked products drew inflows. Understanding this movement requires examining narratives, market structure, and the operational incentives that drive fund flows.

At the narrative level, investors often chase marginal returns and catalysts. Ethereum has had a series of technical and protocol-level developments that can act as near-term catalysts, while derivatives markets have shown growing sophistication and liquidity for ETH products. These factors make Ethereum a tactical choice for managers looking for asymmetric upside or differentiated exposure relative to Bitcoin. When a credible catalyst emerges for one asset, portfolio managers will adjust ETF allocations to reflect those views—especially when execution through an ETF is straightforward.

Operational and structural considerations amplify these narrative moves. ETFs allow rapid reallocation without the custody and settlement frictions that come with direct spot holdings. For large managers, execution costs and market impact matter, so the relative liquidity and fee structures across ETFs are important determinants of flow. If ETH products offer similar liquidity and lower friction relative to bespoke spot positions, they become the natural vehicle for active reweighting.

Microstructure dynamics in the underlying spot and derivatives markets also inform where capital goes. Improved liquidity, narrower spreads, and a deeper options market for ETH reduce slippage for sizable trades and make it easier for funds to scale positions. Additionally, derivatives players sometimes provide synthetic exposure that funds access indirectly via ETFs, which can further concentrate flows toward the asset with a more developed derivative stack.

Importantly, ETF flows should be analyzed alongside on-chain data, futures basis, and options skew to gauge whether reallocations are tactical or structural. Temporary outflows from Bitcoin ETFs can reflect profit-taking or rotation, not structural bearishness. Conversely, sustained inflows into ETH products, combined with supportive on-chain indicators and rising derivatives participation, may suggest a more durable shift.

Ultimately, flows are just one lens: they highlight where capital is moving but not necessarily why at a granular level. A comprehensive assessment combines fund flows with execution metrics, derivatives positioning, and on-chain signals to form a complete view of market intent.`,
    },

    'Ethereum Climbs Above $4,600 as Derivatives Open Interest Hits New Highs': {
      author: 'Bitcoin.com',
      excerpt: 'Ether’s price advance was accompanied by expanding futures and options positions, signaling heightened speculative and hedging demand in derivatives venues.',
      content: `Ethereum’s price advancing above key levels coincided with a notable increase in derivatives open interest, as both futures and options desks saw rising participation. Higher open interest typically indicates that new positions are entering the market, whether from speculative traders betting on continued upside or institutional participants hedging larger exposures.

Derivatives-driven moves can exert outsized influence on spot prices. When futures markets build long exposure via leverage, funding rates adjust and can either support or pressure the underlying spot depending on demand dynamics. Options activity also provides insight into market expectations; heightened call buying, for example, reflects directional optimism, while widening implied volatility often points to increased uncertainty and hedging demand.

Market participants pointed to a confluence of factors driving the flow into derivatives: a more favorable macro backdrop for risk assets, recent technical confirmation on ETH charts, and renewed interest from funds seeking yield or convexity via options strategies. Institutional desks reported increasing order sizes and a willingness from counterparties to offer deeper liquidity as the market accepted the new levels.

At the micro level, dealers adjusted gamma and delta hedges as client flows arrived, which sometimes led to transient feedback loops boosting spot momentum. The growth in open interest also reflected more sophisticated strategies beyond directional bets — structured products, volatility trades, and carry strategies all found expression in the options book. That diversification of trade types can be constructive for market depth, but it also complicates liquidity risk: in stressed scenarios, many of these strategies unwind, potentially amplifying price moves.

Participants cautioned that while expanding open interest with rising prices is often taken as a bullish sign, it is also the environment where downside risk can be amplified if sentiment shifts. Monitoring liquidation levels, funding rate dynamics, and the concentration of positions among large holders provides a clearer picture of systemic vulnerabilities. For now, the derivatives stack is active and engaged, and traders are watching whether this higher involvement translates into a lasting repricing for Ether.`,
    },

    'Philippines Weighs National Bitcoin Reserve Proposal': {
      author: 'Crypto Briefing',
      excerpt: 'Philippine policymakers are considering whether to hold Bitcoin as part of an official reserve strategy, weighing diversification benefits against volatility and regulatory exposure.',
      content: `A policy conversation in the Philippines has brought an unconventional idea to the fore: the possibility of a government-held Bitcoin reserve. Proponents argue that allocating a small portion of sovereign reserves to Bitcoin could diversify holdings and provide an asymmetric upside if the asset appreciates over time. They point to historical examples where unconventional allocations produced portfolio benefits when correlated assets behaved differently.

Yet the counterarguments are substantial and rooted in the core mission of sovereign reserve management: liquidity, stability, and confidence in public finances. Bitcoin’s volatility poses clear challenges to those objectives. For central banks, reserves are a buffer against external shocks and a means to ensure sufficient liquidity in adverse scenarios. Exposing that buffer to a highly price-volatile instrument raises questions about the appropriate mandate and risk tolerance for public institutions.

Operationally, the logistics of holding material Bitcoin reserves are non-trivial. Secure custody solutions for state-level holdings require layered protections: geographically divided key custody, institutional-grade multi-signature setups, insured custody partners, and explicit legal frameworks that clarify ownership, recovery, and jurisdictional issues. Additionally, valuations and accounting standards for digital assets at the sovereign level are immature in many jurisdictions — complicating balance-sheet reporting and external audits.

Political considerations also weigh heavily. A sudden large unrealized loss on a government-held digital asset could provoke political backlash and erode confidence in fiscal stewardship. Conversely, outsized gains might create pressure to monetize positions, potentially distorting policy choices. Some policymakers therefore favor incremental, highly governed pilot programs that emphasize transparency and public reporting, allowing governments to learn about custody, valuation, and macro impacts without risking substantial capital.

In short, while the idea of a Bitcoin reserve has theoretical appeal for diversification advocates, practical, legal, and reputational hurdles mean any move would likely be cautious and limited in scope. The Philippines’ conversation reflects a broader global trend: states are increasingly exploring how to engage with digital assets, but most are proceeding with prudence and a focus on governance.`,
    },
  };

  try {
    for (const [title, data] of Object.entries(updates)) {
      const found = await prisma.article.findFirst({ where: { title } });
      if (!found) {
        console.log('not found:', title);
        continue;
      }
      const contentWords = wordCount(data.content);
      if (contentWords < 300) {
        console.log('content for', title, 'only', contentWords, 'words — skipping');
        continue;
      }
      const updated = await prisma.article.update({
        where: { id: found.id },
        data: {
          author: data.author,
          excerpt: data.excerpt,
          content: data.content,
          ogTitle: data.ogTitle || null,
          ogDescription: data.ogDescription || null,
          updatedAt: new Date(),
        },
      });
      console.log('updated', updated.id, updated.title, 'words:', wordCount(updated.content));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
