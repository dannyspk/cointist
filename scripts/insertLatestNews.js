const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function upsertArticle(a) {
  const slug = slugify(a.title) + '-latest-' + Date.now().toString().slice(-5);
  try {
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      const updated = await prisma.article.update({ where: { id: existing.id }, data: a });
      console.log('updated', updated.id, updated.title);
      return updated;
    }
  } catch (e) {
    // ignore
  }
  const created = await prisma.article.create({ data: { ...a, slug } });
  console.log('created', created.id, created.title);
  return created;
}

(async () => {
  const items = [
    {
      // reworded from Decrypt: "Coinbase, Strategy Lead Crypto Stock Rebound as Bitcoin and Ethereum Soar"
      title: "Coinbase Strategy Bets Help Crypto Stocks Rebound as Bitcoin and Ethereum Climb",
      author: "Decrypt (adapted)",
      category: "News",
      subcategory: "latest",
      excerpt: "Shares tied to crypto saw renewed buying after market moves lifted Bitcoin and Ether, lifting related equities.",
      content: "Market action has pushed major crypto tokens higher, prompting investors to re-evaluate public companies with crypto exposure; trading desks report rotation back into exchanges and custody providers.",
      tags: JSON.stringify(['markets','coinbase','btc','eth']),
      ogTitle: "Coinbase-linked stocks see rebound amid BTC and ETH gains",
      ogDescription: "Market momentum in Bitcoin and Ethereum is helping lift crypto-related equities.",
      published: true,
      // use the original pubDate from Decrypt: Fri, 22 Aug 2025 16:30:59 +0000
      publishedAt: new Date('2025-08-22T16:30:59Z')
    },

    {
      // reworded from Decrypt: "Ethereum, Bitcoin Spike After Powell Signals Interest Rate Cut"
      title: "Markets Rally: Bitcoin and Ethereum Jump After Fed Signals Ease",
      author: "Decrypt (adapted)",
      category: "News",
      subcategory: "latest",
      excerpt: "A dovish tone from the central bank triggered a broad rally, with Bitcoin and Ether posting sharp gains.",
      content: "Investors reacted to comments from policymakers by pricing in easier policy, sending risk assets higher and sparking renewed demand for major cryptocurrencies.",
      tags: JSON.stringify(['macro','fed','btc','eth']),
      ogTitle: "Fed remarks spark crypto rally",
      ogDescription: "Rate-speak from Washington sends Bitcoin and Ethereum higher.",
      published: true,
      publishedAt: new Date('2025-08-22T14:31:38Z')
    },

    {
      // reworded from Decrypt: "Bitcoin ETFs Shed $1 Billion in Five Days Amid Ethereum Comeback"
      title: "ETF Flows Shift: Bitcoin ETFs See Outflows as Ethereum Stages a Comeback",
      author: "Decrypt (adapted)",
      category: "News",
      subcategory: "latest",
      excerpt: "Spot ETF flows showed a pullback from Bitcoin funds while Ether-related products attracted fresh capital.",
      content: "Over the past days, ETF investors rotated holdings, reducing exposure to Bitcoin vehicles and redirecting capital toward Ethereum trackers as on-chain signals turned bullish.",
      tags: JSON.stringify(['etf','flows','btc','eth']),
      ogTitle: "ETF flows indicate rotation toward Ethereum",
      ogDescription: "Investors rebalanced from Bitcoin ETFs into Ethereum-linked products.",
      published: true,
      publishedAt: new Date('2025-08-22T14:29:04Z')
    },

    {
      // reworded from Bitcoin.com: "Ethereum Tops $4,600 as Derivatives Markets Hit Record Levels"
      title: "Ethereum Climbs Above $4,600 as Derivatives Open Interest Hits New Highs",
      author: "Bitcoin.com (adapted)",
      category: "News",
      subcategory: "latest",
      excerpt: "Ether rose past $4,600 amid swelling activity in futures and options markets.",
      content: "Rising derivatives volumes show traders are taking larger positions on Ether, pushing prices higher and increasing market leverage and attention.",
      tags: JSON.stringify(['ethereum','derivatives','markets']),
      ogTitle: "Derivatives activity lifts Ether above $4,600",
      ogDescription: "Options and futures traders are driving larger bets on ETH.",
      published: true,
      publishedAt: new Date('2025-08-22T15:39:47Z')
    },

    {
      // reworded from Reddit-linked article: Philippines considers establishing a national Bitcoin reserve (cryptobriefing)
      title: "Philippines Weighs National Bitcoin Reserve Proposal",
      author: "Crypto Briefing (via Reddit, adapted)",
      category: "News",
      subcategory: "latest",
      excerpt: "Lawmakers in the Philippines are discussing whether a government-held Bitcoin reserve could play a role in national finance policy.",
      content: "A proposal under consideration would let the state hold Bitcoin as part of a diversified reserve strategy; economists warn of volatility risks while supporters argue for long-term diversification.",
      tags: JSON.stringify(['philippines','policy','bitcoin']),
      ogTitle: "Philippine officials debate Bitcoin reserve idea",
      ogDescription: "A government-held BTC reserve is being discussed as a potential policy tool.",
      published: true,
      // Reddit created_utc was 1755867307.0 -> convert to ms
      publishedAt: new Date(1755867307.0 * 1000)
    }
  ];

  try {
    for (const it of items) {
      await upsertArticle(it);
    }
    console.log('done');
  } catch (err) {
    console.error('failed', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
