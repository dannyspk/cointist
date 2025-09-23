const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, '..');
const mappingPath = path.join(__dirname, 'png-to-webp-mapping.json');
if (!fs.existsSync(mappingPath)) {
  console.error('Mapping file not found:', mappingPath);
  process.exit(1);
}
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')).mappings || {};

const exts = ['.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.md'];

function walk(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // skip public and tmp and node_modules
      if (['public', 'tmp', 'node_modules', '.git'].includes(e.name)) continue;
      results.push(...walk(full));
    } else {
      if (exts.includes(path.extname(e.name).toLowerCase())) results.push(full);
    }
  }
  return results;
}

function normalizeRef(ref) {
  // handle absolute domain-prefixed references
  return ref.replace(/^https?:\/\/(?:cointist|www\.cointist)\.(?:com|net)/i, '');
}

function findReplacementsInFile(file, mapping) {
  const src = fs.readFileSync(file, 'utf8');
  const candidates = [];
  for (const [from, to] of Object.entries(mapping)) {
    const normFrom = normalizeRef(from);
    // match quoted or unquoted occurrences
    const re = new RegExp(normFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      candidates.push({ index: m.index, match: m[0], from: normFrom, to });
    }
  }
  return candidates;
}

function runDryRun() {
  const files = walk(workspace);
  const report = [];
  for (const f of files) {
    const rel = path.relative(workspace, f);
    const replacements = findReplacementsInFile(f, mapping);
    if (replacements.length) {
      report.push({ file: rel, count: replacements.length, replacements });
    }
  }

  if (!report.length) {
    console.log('No candidate replacements found.');
    return 0;
  }

  console.log('Dry-run replacements report:');
  for (const r of report) {
    console.log(`\nFile: ${r.file} — ${r.count} match(es)`);
    const shown = r.replacements.slice(0, 10);
    for (const s of shown) {
      console.log(`  - match @${s.index}: ${s.match}  ->  ${s.to}`);
    }
    if (r.replacements.length > shown.length) console.log(`  ...and ${r.replacements.length - shown.length} more`);
  }

  console.log('\nSummary: ' + report.length + ' file(s) contain candidate replacements.');
  return 0;
}

if (require.main === module) {
  const exit = runDryRun();
  process.exit(exit);
}

module.exports = { runDryRun };
