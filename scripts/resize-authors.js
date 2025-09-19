const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async function main(){
  const dir = path.join(process.cwd(), 'public', 'authors');
  const backup = path.join(dir, 'orig');
  try{
    if (!fs.existsSync(dir)) return console.error('authors directory not found:', dir);
    if (!fs.existsSync(backup)) fs.mkdirSync(backup);
    const files = fs.readdirSync(dir).filter(f=>/\.(png|jpe?g|webp)$/i.test(f));
    for (const f of files){
      const src = path.join(dir, f);
      const dst = src; // overwrite in place after backup
      // skip files in the backup folder
      if (src.startsWith(backup)) continue;
      // backup
      const bakPath = path.join(backup, f);
      if (!fs.existsSync(bakPath)) fs.copyFileSync(src, bakPath);
      try{
        await sharp(src)
          .resize(56,56, { fit: 'cover', position: 'centre' })
          .toFile(dst + '.tmp');
        fs.renameSync(dst + '.tmp', dst);
        console.log('Resized', f);
      }catch(err){
        console.error('Failed to process', f, err.message || err);
        // cleanup tmp if exists
        try{ if (fs.existsSync(dst + '.tmp')) fs.unlinkSync(dst + '.tmp'); }catch(e){}
      }
    }
    console.log('Done. Originals kept in public/authors/orig/');
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
