#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const reportPath = path.join(ROOT, 'tmp', 'webp-report.json');
const backupDir = path.join(ROOT, 'tmp', 'webp-backups');
const summaryPath = path.join(ROOT, 'tmp', 'webp-replacements-summary.json');

if (!fs.existsSync(reportPath)) {
  console.error('Report not found:', reportPath);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const refs = report.references || [];

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const changed = [];

for (const r of refs) {
  try {
    if (!r.candidates || r.candidates.length !== 1) continue; // only safe single-candidate replacements
    const candidate = r.candidates[0];
    const filePath = path.join(ROOT, r.file);
    if (!fs.existsSync(filePath)) continue;
    const original = fs.readFileSync(filePath, 'utf8');
    let newContent = original;

    // determine replacement reference string
    let replacementRef;
    if (candidate.startsWith('public/')) {
      replacementRef = '/' + candidate.slice('public/'.length).replace(/\\/g, '/');
    } else {
      // compute relative path from file to candidate
      const candidateAbs = path.join(ROOT, candidate);
      let rel = path.relative(path.dirname(filePath), candidateAbs).replace(/\\/g, '/');
      if (!rel.startsWith('.') && !rel.startsWith('/')) rel = './' + rel;
      replacementRef = rel;
    }

    // replace occurrences inside single/double/backtick quotes
    const search = r.match; // e.g. /assets/foo.png or assets/foo.png
    const quoteVariants = ['"', "'", '`'];
    let madeChange = false;
    for (const q of quoteVariants) {
      const from = q + search + q;
      const to = q + replacementRef + q;
      if (newContent.indexOf(from) !== -1) {
        newContent = newContent.split(from).join(to);
        madeChange = true;
      }
    }

    if (madeChange && newContent !== original) {
      // backup original once per file
      const backupFile = path.join(backupDir, r.file.replace(/[\\/:]/g, '_') + '.orig');
      if (!fs.existsSync(backupFile)) {
        try {
          fs.writeFileSync(backupFile, original, 'utf8');
        } catch (e) {
          console.error('Failed to write backup for', r.file, e.message);
        }
      }

      fs.writeFileSync(filePath, newContent, 'utf8');
      const existing = changed.find(c => c.file === r.file);
      if (existing) existing.count += 1;
      else changed.push({ file: r.file, count: 1, replacement: replacementRef });
      console.log(`Updated ${r.file} line ${r.line}: ${search} -> ${replacementRef}`);
    }
  } catch (e) {
    console.error('Error processing', r.file, e.message);
  }
}

fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), changed }, null, 2), 'utf8');
console.log('\nDone. Summary written to', summaryPath);
if (changed.length === 0) console.log('No safe single-candidate replacements were applied.');
else changed.forEach(c => console.log(`${c.file}: ${c.count} replacements (rep -> ${c.replacement})`));

process.exit(0);
