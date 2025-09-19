#!/usr/bin/env node
/*
Normalize guide HTML files to the desired layout/class structure similar to 2.html.
- Ensures an <article> root wrapper.
- Converts heading-like wrappers (div/span/p with articleH2/articleH3 classes) to <h2>/<h3> with proper classes.
- Ensures existing <h2>/<h3> have class articleH2/articleH3.
- Heuristic: converts p>strong or p>span that look like headings into <h2 class="articleH2">.

Usage:
  node scripts/normalize-guide-layout.js --dir="C:\path\to\folder" [--apply]

When --apply is provided files are modified in-place and .bak backups created.
*/

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dir: null, apply: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dir' || a.startsWith('--dir=')) {
      const val = a.includes('=') ? a.split('=')[1] : args[++i];
      out.dir = val.replace(/\"/g, '');
    } else if (a === '--apply') {
      out.apply = true;
    }
  }
  return out;
}

function ensureArticleWrapper($) {
  const bodyChildren = $('body').children();
  // if there's already an article element that contains the main content, do nothing
  if ($('article').length > 0) return false;
  // otherwise wrap all body children in an <article>
  const html = $('body').html();
  $('body').empty();
  $('body').append(`<article>\n${html}\n</article>`);
  return true;
}

function toHeading($el, level, addClass) {
  const tag = level === 3 ? 'h3' : 'h2';
  const attrs = $el.attr();
  const text = $el.html();
  const newEl = $(`<${tag}></${tag}>`);
  // copy attrs except class (we'll set/merge below)
  Object.keys(attrs || {}).forEach(k => {
    if (k !== 'class') newEl.attr(k, attrs[k]);
  });
  // set/merge class
  const classes = (attrs && attrs.class) ? attrs.class.split(/\s+/) : [];
  if (!classes.includes(addClass)) classes.push(addClass);
  newEl.attr('class', classes.join(' ').trim());
  newEl.html(text);
  $el.replaceWith(newEl);
  return newEl;
}

function enforceHeadingClasses($) {
  let changed = false;
  $('h2').each(function() {
    const el = $(this);
    const cls = (el.attr('class') || '').split(/\s+/).filter(Boolean);
    if (!cls.includes('articleH2')) {
      cls.push('articleH2');
      el.attr('class', cls.join(' '));
      changed = true;
    }
  });
  $('h3').each(function() {
    const el = $(this);
    const cls = (el.attr('class') || '').split(/\s+/).filter(Boolean);
    if (!cls.includes('articleH3')) {
      cls.push('articleH3');
      el.attr('class', cls.join(' '));
      changed = true;
    }
  });
  return changed;
}

function convertWrapperClasses($) {
  // div.articleH2, span.articleH2, p.articleH2 -> h2.articleH2
  let changed = false;
  ['div', 'span', 'p'].forEach(tag => {
    $(`${tag}.articleH2`).each(function() {
      toHeading($(this), 2, 'articleH2');
      changed = true;
    });
    $(`${tag}.articleH3`).each(function() {
      toHeading($(this), 3, 'articleH3');
      changed = true;
    });
  });
  return changed;
}

function unwrapHeadingsInParagraphs($) {
  let changed = false;
  $('p').each(function() {
    const p = $(this);
    // if p contains only a heading-like element as its first child, e.g., <p><strong>Title</strong></p>
    const first = p.children().first();
    if (!first || !first.length) return;
    if (first.is('strong') || first.is('b') || first.is('span')) {
      const text = first.text().trim();
      if (text && text.length < 200 && /[A-Za-z0-9]/.test(text[0])) {
        // convert first to h2
        const newH = $(`<h2 class="articleH2"></h2>`);
        newH.html(first.html());
        // collect remaining nodes inside p
        const remaining = p.contents().filter(function(i, el) { return el !== first[0]; }).map(function(i, el) { return $(el).clone(); }).get();
        p.replaceWith(newH);
        if (remaining.length) newH.after(remaining.map(n => $.html(n)).join('\n'));
        changed = true;
      }
    }
  });
  return changed;
}

function stripEditorAnnotations($) {
  // Remove text nodes that look like editor annotations, e.g. "Juan, [9/3/2025 11:19 PM]"
  // or standalone bracketed timestamps. Conservative removal: only remove nodes
  // that contain primarily the annotation.
  let removed = false;
  const tsBracket = /\[\s*\d{1,2}\/\d{1,2}\/\d{4}[^\]]*\]/; // [9/3/2025 11:19 PM]
  const nameTs = /^\s*[A-Za-z]{2,30},\s*\[.*\]\s*$/; // Juan, [9/3/2025 11:19 PM]

  $('*').contents().each(function(i, node) {
    if (node.type === 'text') {
      const txt = node.data || '';
      if (nameTs.test(txt) || /^\s*\[\s*\d{1,2}\/\d{1,2}\/\d{4}.*\]\s*$/.test(txt) || (tsBracket.test(txt) && txt.trim().length < 120 && txt.trim().split('\n').length<=2)) {
        // remove this text node
        removed = true;
        node.data = '';
      }
    }
    // also remove small comment nodes that look like editor notes
    if (node.type === 'comment') {
      const c = node.data || '';
      if (/editor|edited|note|juan|timestamp|\d{4}/i.test(c) && c.length < 200) {
        removed = true;
        // cheerio doesn't provide direct comment removal API; replace with empty string
        node.data = '';
      }
    }
  });

  // Also remove standalone nodes that are only a bracketed timestamp element
  $('*').each(function() {
    const el = $(this);
    const text = el.text().trim();
    if (tsBracket.test(text) && text.length < 120 && el.children().length === 0) {
      el.remove();
      removed = true;
    }
  });

  return removed;
}

async function processFile(filePath, apply) {
  const src = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(src, { decodeEntities: false });
  let changed = false;

  changed = ensureArticleWrapper($) || changed;
  changed = convertWrapperClasses($) || changed;
  changed = unwrapHeadingsInParagraphs($) || changed;
  changed = enforceHeadingClasses($) || changed;

  if (changed && apply) {
    try { fs.copyFileSync(filePath, filePath + '.bak'); } catch (e) { console.error('Backup failed for', filePath, e.message); }
    fs.writeFileSync(filePath, $.html(), 'utf8');
  }
  return { filePath, changed };
}

async function main() {
  const opts = parseArgs();
  if (!opts.dir) { console.error('Missing --dir argument.'); process.exit(1); }
  const abs = path.resolve(opts.dir);
  if (!fs.existsSync(abs)) { console.error('Directory does not exist:', abs); process.exit(1); }
  const files = fs.readdirSync(abs).filter(f => f.toLowerCase().endsWith('.html'));
  if (!files.length) { console.error('No .html files found in', abs); process.exit(1); }
  const results = [];
  for (const f of files) {
    const p = path.join(abs, f);
    try {
      const r = await processFile(p, opts.apply);
      results.push(r);
      console.log(`${r.changed ? (opts.apply ? 'UPDATED ' : 'WILL UPDATE') : 'SKIPPED '} - ${f}`);
    } catch (e) {
      console.error('ERROR processing', f, e.stack || e.message);
    }
  }
  const changedCount = results.filter(r => r.changed).length;
  console.log(`\nDone. ${changedCount} file(s) ${opts.apply ? 'modified' : 'would be modified'}.`);
  if (!opts.apply && changedCount > 0) console.log('Run again with --apply to write changes (backups will be created with .bak suffix).');
}

main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
