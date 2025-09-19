const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function toFsPath(webPath){
  if (!webPath) return null;
  // normalize paths like /assets/foo.jpg or /assets/images/foo.jpg
  const p = webPath.replace(/^\//, '');
  return path.join(process.cwd(), 'public', p);
}

function thumbWebPathFor(fileWebPath){
  if (!fileWebPath) return null;
  const ext = path.extname(fileWebPath);
  const base = fileWebPath.slice(0, -ext.length);
  return `${base}-thumb.jpg`;
}

async function ensureThumb(srcFs, outFs){
  if (!fs.existsSync(srcFs)) throw new Error('Source not found: ' + srcFs);
  if (fs.existsSync(outFs)) return; // already exists
  await sharp(srcFs).resize(320, 180, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78 }).toFile(outFs);
}

(async ()=>{
  try{
    console.log('Scanning DB for Opinions articles...');
    const items = await prisma.article.findMany({ where: { category: 'Opinions' } });
    console.log('Found', items.length, 'opinion articles');
    for (const it of items){
      try{
        const cover = it.coverImage || '';
        if (!cover) { console.log('Skipping id', it.id, 'no coverImage'); continue; }
        const srcFs = toFsPath(cover);
        if (!srcFs || !fs.existsSync(srcFs)) { console.log('Skipping id', it.id, 'cover file not found:', srcFs); continue; }
        const webThumb = thumbWebPathFor(cover);
        const outFs = toFsPath(webThumb);
        if (!outFs) { console.log('Skipping id', it.id, 'could not derive out path'); continue; }
        await ensureThumb(srcFs, outFs);
        // update DB if thumbnail different
        if (String(it.thumbnail || '') !== String(webThumb)){
          const updated = await prisma.article.update({ where: { id: it.id }, data: { thumbnail: webThumb } });
          console.log('Updated article', it.id, 'thumbnail ->', webThumb);
        } else {
          console.log('Thumbnail already set for', it.id);
        }
      }catch(e){ console.error('Error processing article', it.id, e && e.message); }
    }
    console.log('Done.');
  }catch(e){ console.error('Fatal error', e && e.message); process.exitCode = 1 }
  finally{ await prisma.$disconnect(); }
})();
