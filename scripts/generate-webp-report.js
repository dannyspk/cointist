#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const outPath = path.join(ROOT, 'tmp', 'webp-report.json');
const scanDirs = ['.'];
const fileExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.md', '.cjs', '.css'];

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

function readLines(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.split(/\r?\n/);
}

const webpFiles = [];
const references = []; // {file, line, text, match}

// 1) collect all .webp files
walk(ROOT, (file) => {
  if (file.includes(path.join('node_modules', path.sep))) return;
  if (file.toLowerCase().endsWith('.webp')) webpFiles.push(path.relative(ROOT, file).replace(/\\/g, '/'));
});

// build basename map
const webpBasenameMap = webpFiles.reduce((acc, p) => {
  const b = path.basename(p, '.webp');
  acc[b] = acc[b] || [];
  acc[b].push(p);
  return acc;
}, {});

// 2) scan text files for png/jpg/jpeg references
const imageRegex = /(["'`])((?:\/|\.\/|\.\.\/)?(?:[\w\-\/@\.]+?)\.(png|jpe?g))\1/gi;

walk(ROOT, (file) => {
  const ext = path.extname(file).toLowerCase();
  if (!fileExts.includes(ext)) return;
  if (file.includes(path.join('node_modules', path.sep))) return;
  let lines;
  try { lines = readLines(file); } catch (e) { return; }
  lines.forEach((ln, idx) => {
    let m;
    while ((m = imageRegex.exec(ln)) !== null) {
      const match = m[2];
      references.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), line: idx + 1, text: ln.trim(), match });
    }
  });
});

// 3) heuristic mapping: for each reference, try these candidates:
// - if starts with / => public + ref
// - same dir as file
// - basename match to any webp

function existsSyncPosix(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

const mapped = references.map(r => {
  const res = { ...r, candidates: [] };
  const ref = r.match;
  // if absolute-like
  if (ref.startsWith('/')) {
    const candidate = path.join(ROOT, 'public', ref.replace(/^\//, ''));
    if (existsSyncPosix(candidate + '.webp')) res.candidates.push(path.relative(ROOT, candidate + '.webp').replace(/\\/g, '/'));
    if (existsSyncPosix(candidate)) {
      // maybe there's same-name.webp next to it
      const alt = candidate.replace(/\.(png|jpe?g)$/i, '.webp');
      if (existsSyncPosix(alt)) res.candidates.push(path.relative(ROOT, alt).replace(/\\/g, '/'));
    }
  }
  // same dir as referencing file
  try {
    const refPath = r.match.replace(/^\/+/, '');
    const fileDir = path.dirname(path.join(ROOT, r.file));
    const same = path.join(fileDir, refPath);
    const sameWebp = same.replace(/\.(png|jpe?g)$/i, '.webp');
    if (existsSyncPosix(sameWebp)) res.candidates.push(path.relative(ROOT, sameWebp).replace(/\\/g, '/'));
  } catch (e) {}
  // basename matches
  try {
    const base = path.basename(ref).replace(/\.(png|jpe?g)$/i, '');
    if (webpBasenameMap[base]) {
      res.candidates.push(...webpBasenameMap[base]);
    }
  } catch (e) {}
  // unique-ify
  res.candidates = Array.from(new Set(res.candidates));
  return res;
});

// Write report
const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  counts: { webpFiles: webpFiles.length, imageReferences: references.length },
  webpFiles,
  references: mapped,
};

try {
  if (!fs.existsSync(path.join(ROOT, 'tmp'))) fs.mkdirSync(path.join(ROOT, 'tmp'));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote report: ${outPath}`);
  console.log(`Found ${webpFiles.length} .webp files and ${references.length} image references (png/jpg).`);
} catch (e) {
  console.error('Failed to write report:', e.message);
  process.exit(2);
}

process.exit(0);
