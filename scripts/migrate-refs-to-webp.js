#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const scanDirs = ['src', 'components', 'pages', 'scripts', 'lib', 'tmp', 'docs', 'public'];
const exts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.md', '.cjs'];

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', '.git', 'backups'].includes(e.name)) continue;
      walk(p, cb);
    } else {
      cb(p);
    }
  }
}

const assetRegex = /(["'`])((?:\/assets|\/uploads|\/images|\/assets\/guides|\/assets\/img)[^"'`\s]+?)\.(png|jpe?g)\1/gi;

const changed = [];

for (const dir of scanDirs) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  walk(abs, (file) => {
    const fileExt = path.extname(file).toLowerCase();
    if (!exts.includes(fileExt)) return;
    let content = null;
    try { content = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
    let out = content;
    let match;
    const replacedForFile = [];
    while ((match = assetRegex.exec(content)) !== null) {
      const quote = match[1];
      const relPathNoExt = match[2];
      const origExt = match[3];
      // resolve to public path
      const publicPath = path.join(ROOT, 'public', relPathNoExt.replace(/^\//, ''));
      const webpPath = publicPath + '.webp';
      if (fs.existsSync(webpPath)) {
        const origRef = `${quote}${relPathNoExt}.${origExt}${quote}`;
        const newRef = `${quote}${relPathNoExt}.webp${quote}`;
        if (out.indexOf(origRef) !== -1) {
          out = out.split(origRef).join(newRef);
          replacedForFile.push({ from: origRef, to: newRef });
        }
      }
    }
    if (replacedForFile.length > 0 && out !== content) {
      fs.writeFileSync(file, out, 'utf8');
      changed.push({ file: path.relative(ROOT, file), changes: replacedForFile.length });
      console.log(`Updated ${file} -> ${replacedForFile.length} refs`);
    }
  });
}

console.log('\nMigration complete. Summary:');
if (changed.length === 0) console.log('No references updated.');
else changed.forEach(c => console.log(`${c.file}: ${c.changes} refs updated`));

// Exit code 0
process.exit(0);
