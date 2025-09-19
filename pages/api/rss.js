import prisma from '../../src/lib/prisma';
import db from '../../src/lib/db';

export default async function handler(req, res) {
  const items = await db.findArticles({ where: { published: true }, take: 50 });
  const base = process.env.SITE_URL || 'https://cointist.net';
  const rssItems = items.map(it=>{
    const cat = it.category ? String(it.category).toLowerCase() : 'articles';
    return `<item><title><![CDATA[${it.title}]]></title><link>${base}/${encodeURIComponent(cat)}/articles/${encodeURIComponent(it.slug)}</link><pubDate>${it.publishedAt ? new Date(it.publishedAt).toUTCString() : ''}</pubDate><description><![CDATA[${it.excerpt || ''}]]></description></item>`
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0"><channel><title>Site RSS</title><link>${base}</link><description>Latest articles</description>${rssItems}</channel></rss>`;
  res.setHeader('Content-Type','application/xml');
  res.status(200).send(xml);
}
