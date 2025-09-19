#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'tmp', 'images');
const outReport = path.join(process.cwd(), 'tmp', 'convert-images-report.json');

async function main(){
  if (!fs.existsSync(DIR)){
    console.error('Directory not found:', DIR);
    process.exit(2);
  }

  let sharp;
  try { sharp = require('sharp'); } catch (e) {
    console.error('sharp is not installed. Run: npm install sharp');
    process.exit(2);
  }

  const files = fs.readdirSync(DIR).filter(f=>/[.](png|jpe?g|webp)$/i.test(f));
  const report = { generatedAt: new Date().toISOString(), converted: [], skipped: [] };

  for (const f of files) {
    const abs = path.join(DIR, f);
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f, ext);
    const outName = base + '.webp';
    const outPath = path.join(DIR, outName);

    if (ext === '.webp') {
      report.skipped.push({ file: f, reason: 'already webp' });
      continue;
    }

    try {
      await sharp(abs)
        .webp({ quality: 86 })
        .toFile(outPath);
      report.converted.push({ from: f, to: outName });
      console.log(`Converted ${f} -> ${outName}`);
    } catch (e) {
      report.skipped.push({ file: f, reason: e.message });
      console.error(`Failed ${f}:`, e.message);
    }
  }

  fs.writeFileSync(outReport, JSON.stringify(report, null, 2), 'utf8');
  console.log('\nConversion complete. Report:', outReport);
}

main();
