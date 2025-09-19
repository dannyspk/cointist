const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p));
    else if (stat.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

function clean(text) {
  // Remove literal lines that are just "Copy" or contain only whitespace + Copy
  text = text.replace(/^\s*Copy\s*\r?\n?/gm, '');
  // Remove the exact phrase "Paydax Whitepaper V6"
  text = text.replace(/Paydax Whitepaper V6/g, '');

  // Remove Previous/Next navigation lines that look like: [Previous...](...) [Next...](...)
  // or single bracketed links that include Previous or Next
  text = text.replace(/^\s*\[Previous[\s\S]*?\)\s*\[Next[\s\S]*?\)\s*\r?\n?/gmi, '');
  text = text.replace(/^\s*\[Previous[\s\S]*?\)\s*\r?\n?/gmi, '');
  text = text.replace(/^\s*\[Next[\s\S]*?\)\s*\r?\n?/gmi, '');

  // Remove any line that starts with 'Last updated' (case-insensitive)
  text = text.replace(/^\s*Last updated.*\r?\n?/gmi, '');

  // Cleanup multiple consecutive blank lines to max 2
  text = text.replace(/(\r?\n){3,}/g, '\n\n');

  // Trim trailing whitespace
  return text.trim() + '\n';
}

(async function main(){
  const base = path.resolve(__dirname, '..', 'docs', 'gitbook');
  if (!fs.existsSync(base)) {
    console.error('docs/gitbook not found');
    process.exit(1);
  }

  const spaceDirs = fs.readdirSync(base).filter(n => n.startsWith('space-')).map(n => path.join(base, n));
  const files = [];
  for (const dir of spaceDirs) {
    files.push(...walk(dir));
  }

  if (!files.length) {
    console.log('No markdown files found under docs/gitbook/space-*');
    return;
  }

  let changed = 0;
  for (const f of files) {
    const orig = fs.readFileSync(f, 'utf8');
    const cleaned = clean(orig);
    if (cleaned !== orig) {
      fs.writeFileSync(f, cleaned, 'utf8');
      changed++;
      console.log('Cleaned', path.relative(process.cwd(), f));
    }
  }

  console.log(`Done. Files scanned: ${files.length}. Files changed: ${changed}`);
})();
