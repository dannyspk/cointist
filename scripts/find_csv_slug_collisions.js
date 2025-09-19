const fs = require('fs');
const path = require('path');

function parseCsvSync(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const hdrRow = lines[0];
  let cur = '', inQ = false;
  const hdrs = [];
  for (let i = 0; i < hdrRow.length; i++){
    const ch = hdrRow[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { hdrs.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.length) hdrs.push(cur);
  const out = [];
  for (let r = 1; r < lines.length; r++){
    const row = lines[r];
    const cols = [];
    cur = ''; inQ = false;
    for (let i = 0; i < row.length; i++){
      const ch = row[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);
    const obj = {};
    for (let c = 0; c < hdrs.length; c++) obj[hdrs[c]] = cols[c] === undefined ? '' : cols[c];
    out.push(obj);
  }
  return out;
}

function slugify(s){ if (!s) return ''; return String(s).toLowerCase().replace(/<[^>]*>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,200) || ''; }

const csvPath = path.resolve(process.cwd(), 'public', 'Article_rows.csv');
if (!fs.existsSync(csvPath)){ console.error('CSV not found'); process.exit(1); }
const raw = fs.readFileSync(csvPath,'utf8');
const records = parseCsvSync(raw);
const counts = {};
for (const r of records){
  let slug = (r.slug && String(r.slug).trim()) || '';
  if (!slug) slug = slugify(r.title) || slugify(r.excerpt) || 'article'; else slug = slugify(slug) || slug;
  counts[slug] = (counts[slug]||0)+1;
}
const duplicates = Object.entries(counts).filter(([s,c])=>c>1).sort((a,b)=>b[1]-a[1]);
console.log('Total rows:', records.length);
console.log('Unique slugs:', Object.keys(counts).length);
if (duplicates.length===0) { console.log('No duplicates'); process.exit(0); }
console.log('Duplicates:');
for (const [s,c] of duplicates) console.log(c, s);
