import prisma from '../../../src/lib/prisma';
import db from '../../../src/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
  const categories = ['News','Articles','Guides','Sponsored'];
    const counts = {};
    for (const c of categories) {
      counts[c] = await db.countArticles({ category: c });
    }
    const total = await db.countArticles();
    res.json({ total, counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
