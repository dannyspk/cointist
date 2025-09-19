const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const id = 19;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      console.log('article not found id', id);
      process.exit(1);
    }

    const formatted = `
<h3>ETF flows show tactical rotation toward Ethereum</h3>
<p>Exchange-traded products remain a primary vehicle for fast, liquid exposure to crypto assets. Recent flow data point to a tactical reallocation: Bitcoin-focused ETFs experienced short-term outflows while funds tied to Ethereum collected fresh capital.</p>
<blockquote>"Flows are often the market’s quickest expression of where marginal capital is going — and right now that capital is finding an attractive home in ETH products," said a portfolio manager monitoring ETF activity.</blockquote>
<p>Several factors help explain the shift:</p>
<ul>
  <li><strong>Narrative and catalysts:</strong> Ethereum has benefited from positive technical signals and protocol-level developments that can act as near-term performance catalysts.</li>
  <li><strong>Operational convenience:</strong> ETFs provide on-exchange liquidity without custody friction, making them ideal for tactical reweights.</li>
  <li><strong>Microstructure:</strong> Improved liquidity, tighter spreads, and a deeper derivatives market for ETH reduce execution costs for large allocations.</li>
</ul>
<p>That said, a single lens — fund flows — does not tell the entire story. Temporary outflows from Bitcoin ETFs can reflect profit-taking or rotation rather than structural weakness. Conversely, sustained inflows into ETH products, combined with corroborating on-chain and derivatives signals, would suggest a more durable shift in investor preference.</p>
<p>Practitioners recommend a composite approach: combine flows with order-book dynamics, futures basis, and options skew to assess intent and durability. For now, the data indicate a tactical pivot in allocation rather than an outright re-rating of the long-term case for either asset.</p>
<p><em>How this affects investors:</em> Managers seeking to implement similar rotations should consider execution costs, slippage, and derivative exposures when choosing between direct spot holdings and ETF wrappers. Proper risk controls remain paramount as elevated leverage in derivatives can quickly amplify moves.</p>
`;

    const updated = await prisma.article.update({
      where: { id },
      data: {
        content: formatted,
        excerpt: 'ETF flows show a tactical rotation: Bitcoin ETFs saw outflows while Ethereum products attracted inflows; analyze flows with on-chain and derivatives data for context.',
        updatedAt: new Date(),
      },
    });

    console.log('updated', updated.id, updated.title);
  } catch (err) {
    console.error('error', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
