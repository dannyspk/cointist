import { getPrismaSync } from './prisma';
const prisma = getPrismaSync && typeof getPrismaSync === 'function' ? getPrismaSync() : null;

const INTERVAL_MS = 30 * 1000; // check every 30s

async function checkAndPublish() {
  try {
    if (!prisma || !prisma.article) {
      console.warn('[scheduler] Prisma client not available; skipping check');
      return;
    }
    const now = new Date();
    let toPublish = [];
    try {
      // primary: ask DB to return unpublished articles with scheduledAt <= now
      toPublish = await prisma.article.findMany({ where: { published: false, scheduledAt: { lte: now } } });
    } catch (dbErr) {
      // fallback: Prisma schema might not have scheduledAt (mismatch). Query unpublished and filter in JS
      console.warn('[scheduler] DB-side scheduledAt filter failed, falling back to client-side filter', dbErr && dbErr.message);
      const allUnpublished = await prisma.article.findMany({ where: { published: false } });
      toPublish = allUnpublished.filter(a => a.scheduledAt && new Date(a.scheduledAt) <= now);
    }

    for (const art of toPublish) {
      try {
        await prisma.article.update({ where: { id: art.id }, data: { published: true, publishedAt: new Date() } });
        console.log('[scheduler] Published article', art.id, art.title);
      } catch (e) { console.error('[scheduler] failed to publish', art.id, e); }
    }
  } catch (e) {
    console.error('[scheduler] check failed', e);
  }
}

if (!global.__schedulerInitialized) {
  global.__schedulerInitialized = true;
  // start interval
  setInterval(checkAndPublish, INTERVAL_MS);
  // run once immediately
  checkAndPublish().catch(()=>{});
}

export default { checkAndPublish };
