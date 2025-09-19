// Resize cointist-logo.png into favicon assets: 32x32 webp and png, and create an .ico
// Usage: node scripts/make_favicons.js
const fs = require('fs');
const path = require('path');
async function main() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico');

  const root = path.resolve(__dirname, '..');
  const candidates = [
    path.join(root, 'cointist-logo.png'),
    path.join(root, 'public', 'cointist-logo.png'),
    path.join(root, 'public', 'assets', 'cointist-logo.png'),
  ];
  let input = candidates.find(p => fs.existsSync(p));
  if (!input) input = candidates[0];
  const outDir = path.join(root, 'public');
  const assetsDir = path.join(outDir, 'assets');

  if (!fs.existsSync(input)) {
    console.error('Input logo not found at', input);
    process.exit(1);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const png32 = path.join(outDir, 'favicon.png');
  const webp32 = path.join(assetsDir, 'favicon-32.webp');
  const ico32 = path.join(outDir, 'favicon.ico');

  console.log('Attempting to resize from', input, '->', webp32, png32);

  // load buffer first (more robust for strange encodings)
  if (!fs.existsSync(input)) {
    throw new Error('Input logo not found at any known location. Tried: ' + candidates.join(', '));
  }
  const buf = fs.readFileSync(input);

  // create 32x32 WebP first, then PNG
  try {
    await sharp(buf)
      .resize(32, 32, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(webp32);
    console.log('Wrote', webp32);
  } catch (err) {
    console.warn('webp conversion failed:', err.message);
  }

  try {
    await sharp(buf)
      .resize(32, 32, { fit: 'cover' })
      .png({ quality: 90 })
      .toFile(png32);
    console.log('Wrote', png32);
  } catch (err) {
    console.warn('png conversion failed:', err.message);
  }

  // create favicon.ico from PNG
  try {
    const icoBuffer = await pngToIco([png32]);
    fs.writeFileSync(ico32, icoBuffer);
    console.log('Wrote', ico32);
  } catch (err) {
    console.warn('png-to-ico failed:', err.message);
  }

  console.log('Wrote', png32);
  console.log('Wrote', webp32);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
