#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const backupDir = path.join(ROOT, 'tmp', 'webp-backups');
const summaryPath = path.join(ROOT, 'tmp', 'webp-replacements-all-summary.json');
const webpReportPath = path.join(ROOT, 'tmp', 'webp-report.json');

if (!fs.existsSync(webpReportPath)) {
  console.error('webp report not found, please run scripts/generate-webp-report.js first');
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(webpReportPath, 'utf8'));
const webpFiles = report.webpFiles || [];

const webpBasenameMap = webpFiles.reduce((acc, p) => {
  const b = path.basename(p, '.webp');
  acc[b] = acc[b] || [];
  acc[b].push(p);
  return acc;
}, {});

const textExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.md', '.cjs', '.css', '.scss', '.yml'];

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

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const imageRegex = /(["'`])((?:\/|\.\/|\.\.\/)?(?:[\w\-\/@\.]+?)\.(png))\1/gi;
const changes = [];

walk(ROOT, (file) => {
  const ext = path.extname(file).toLowerCase();
  if (!textExts.includes(ext)) return;
  if (file.includes(path.join('node_modules', path.sep))) return;
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  let out = content;
  let m;
  const fileChanges = [];
  while ((m = imageRegex.exec(content)) !== null) {
    const quote = m[1];
    const ref = m[2]; // path with .png
    const bareRef = ref.replace(/^\/+/, '');
    const base = path.basename(ref, '.png');

    let replacement = null;

    // 1) check same-path .webp (absolute/public or same folder)
    if (ref.startsWith('/')) {
      const candidate = path.join(ROOT, 'public', bareRef);
      const candidateWebp = candidate.replace(/\.png$/i, '.webp');
      if (fs.existsSync(candidateWebp)) replacement = '/' + path.relative(path.join(ROOT, 'public'), candidateWebp).replace(/\\/g, '/');
      else if (fs.existsSync(candidate)) {
        const alt = candidate.replace(/\.png$/i, '.webp');
        if (fs.existsSync(alt)) replacement = '/' + path.relative(path.join(ROOT, 'public'), alt).replace(/\\/g, '/');
      }
    } else {
      // same directory as file
      const same = path.join(path.dirname(file), bareRef);
      const sameWebp = same.replace(/\.png$/i, '.webp');
      if (fs.existsSync(sameWebp)) {
        let rel = path.relative(path.dirname(file), sameWebp).replace(/\\/g, '/');
        if (!rel.startsWith('.') && !rel.startsWith('/')) rel = './' + rel;
        replacement = rel;
      }
    }

    // 2) basename map
    if (!replacement && webpBasenameMap[base] && webpBasenameMap[base].length === 1) {
      const cand = webpBasenameMap[base][0];
      replacement = cand.startsWith('public/') ? '/' + cand.slice('public/'.length) : './' + cand;
    } else if (!replacement && webpBasenameMap[base] && webpBasenameMap[base].length > 1) {
      // prefer one under public/assets if present
      const pref = webpBasenameMap[base].find(p => p.startsWith('public/assets')) || webpBasenameMap[base][0];
      replacement = pref.startsWith('public/') ? '/' + pref.slice('public/'.length) : './' + pref;
    }

    // 3) fallback: replace extension only
    if (!replacement) {
      replacement = ref.replace(/\.png$/i, '.webp');
    }

    const from = quote + ref + quote;
    const to = quote + replacement + quote;
    if (out.indexOf(from) !== -1) {
      out = out.split(from).join(to);
      fileChanges.push({ from: ref, to: replacement });
    }
  }

  if (fileChanges.length > 0 && out !== content) {
    const backupFile = path.join(backupDir, file.replace(/[\\/:]/g, '_') + '.orig');
    if (!fs.existsSync(backupFile)) fs.writeFileSync(backupFile, content, 'utf8');
    fs.writeFileSync(file, out, 'utf8');
    changes.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), changes: fileChanges.length });
    console.log(`Updated ${file}: ${fileChanges.length} refs`);
  }
});

fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), changes }, null, 2), 'utf8');
console.log('\nAggressive replacement complete. Summary written to', summaryPath);
if (changes.length === 0) console.log('No .png references replaced.');
else changes.forEach(c => console.log(`${c.file}: ${c.changes} replacements`));

process.exit(0);
