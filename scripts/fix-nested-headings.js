#!/usr/bin/env node
/*
Aggressive heading normalizer.
 - Converts heading-like wrappers (e.g. div.articleH2, span.articleH2) into <h2>
 - Unwraps headings that are inside <p> or other wrappers and moves following nodes correctly
 - Merges attributes (id/class) conservatively
Usage:
  npm install cheerio
  node scripts/fix-nested-headings.js --dir="C:\path\to\folder"        # dry-run
  node scripts/fix-nested-headings.js --dir="C:\path\to\folder" --apply  # apply with .bak backups
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

function attrObj(elem) {
  const attrs = {};
  const at = elem.attr && elem.attr();
  if (!at) return attrs;
  Object.keys(at).forEach(k => { attrs[k] = at[k]; });
  return attrs;
}

function mergeAttrs(a, b) {
  const out = Object.assign({}, a, b);
  if (a.class && b.class) {
    const A = a.class.split(/\s+/).filter(Boolean);
    const B = b.class.split(/\s+/).filter(Boolean);
    out.class = Array.from(new Set([...A, ...B])).join(' ');
  }
  if (!b.id && a.id) out.id = a.id;
  return out;
}

function replaceWithHeading($, oldEl, level, attrs) {
  const tag = level === 3 ? 'h3' : 'h2';
  const el = $(`<${tag}></${tag}>`);
  if (attrs) Object.keys(attrs).forEach(k => el.attr(k, attrs[k]));
  el.html(oldEl.html());
  oldEl.replaceWith(el);
  return el;
}

function convertWrapperSelectors($) {
  // common classes used by imported HTML (articleH2, articleH3, article-heading, articleTitle...)
  const mapping = [ ['articleH3', 3], ['articleH2', 2], ['articleH1', 2], ['article-heading', 2], ['articleTitle', 2] ];
  let changed = false;
  mapping.forEach(([cls, lvl]) => {
    $(`div.${cls}, span.${cls}, p.${cls}`).each(function() {
      const el = $(this);
      const attrs = attrObj(el);
      replaceWithHeading($, el, lvl, attrs);
      changed = true;
    });
  });
  return changed;
}

function unwrapHeadingsInParagraphs($) {
  // Find paragraphs containing a single strong/b/span/div that looks like a heading and convert
  let changed = false;
  $('p').each(function() {
    const p = $(this);
    // if p directly contains an h2/h3, lift it out
    const innerH2 = p.children('h2, h3').first();
    if (innerH2 && innerH2.length) {
      const level = innerH2.is('h3') ? 3 : 2;
      const attrs = attrObj(innerH2);
      const newHeading = replaceWithHeading($, innerH2, level, attrs);
      // move following siblings that were inside the paragraph to after the new heading
      const remaining = [];
      let sib = newHeading.next();
      while (sib && sib.length) {
        // shouldn't happen because newHeading replaced innerH2, but keep for safety
        remaining.push(sib.clone());
        sib = sib.next();
      }
      p.replaceWith(newHeading);
      if (remaining.length) newHeading.after(remaining.map(n => $.html(n)).join('\n'));
      changed = true;
      return; // continue to next p
    }

    // otherwise, look for p > strong, p > b, p > span that look heading-like
    const candidate = p.children('strong, b, span, div').first();
    if (candidate && candidate.length) {
      const text = candidate.text().trim();
      if (text && text.length < 200 && /[A-Z]/.test(text[0])) {
        // heuristics: treat this as a heading
        const attrs = attrObj(candidate);
        const newH = replaceWithHeading($, candidate, 2, attrs);
        // put the new heading where the paragraph was: replace p with newH + remaining inner nodes
        const innerHtml = p.html();
        // remove the candidate from innerHtml since it's now the heading
        // clone remaining nodes
        const remaining = p.contents().filter(function() { return this !== candidate[0]; }).map(function(i, el) { return $(el).clone(); }).get();
        p.replaceWith(newH);
        if (remaining.length) newH.after(remaining.map(n => $.html(n)).join('\n'));
        changed = true;
      }
    }
  });
  return changed;
}

function removeEmptyWrappers($) {
  let changed = false;
  // remove empty spans/divs that only wrap a heading
  $('div, span').each(function() {
    const el = $(this);
    const children = el.children();
    if (children.length === 1 && (children.is('h2') || children.is('h3'))) {
      const child = children.first();
      const merged = mergeAttrs(attrObj(el), attrObj(child));
      const tag = child.is('h3') ? 'h3' : 'h2';
      const newHeading = $(`<${tag}></${tag}>`);
      Object.keys(merged).forEach(k => newHeading.attr(k, merged[k]));
      newHeading.html(child.html());
      el.replaceWith(newHeading);
      changed = true;
    }
  });
  return changed;
}

async function processFile(filePath, apply) {
  const src = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(src, { decodeEntities: false });
  let changed = false;

  // 1) handle nested h2 inside h2 (previous logic)
  $('h2').each(function() {
    const outer = $(this);
    const inner = outer.find('h2').first();
    if (inner && inner.length) {
      const afterNodes = [];
      let sibling = inner.next();
      while (sibling && sibling.length) {
        afterNodes.push(sibling.clone());
        sibling = sibling.next();
      }
      const mergedAttrs = mergeAttrs(attrObj(outer), attrObj(inner));
      const newInner = $('<h2></h2>');
      Object.keys(mergedAttrs).forEach(k => newInner.attr(k, mergedAttrs[k]));
      newInner.html(inner.html());
      outer.replaceWith(newInner);
      if (afterNodes.length) newInner.after(afterNodes.map(n => $.html(n)).join('\n'));
      changed = true;
    }
  });

  // 2) convert wrapper classes to real headings
  changed = convertWrapperSelectors($) || changed;

  // 3) unwrap headings that live inside paragraphs
  changed = unwrapHeadingsInParagraphs($) || changed;

  // 4) remove empty wrappers around headings
  changed = removeEmptyWrappers($) || changed;

  const out = $.html();
  if (changed) {
    if (apply) {
      try { fs.copyFileSync(filePath, filePath + '.bak'); } catch (e) { console.error('Backup failed for', filePath, e.message); }
      fs.writeFileSync(filePath, out, 'utf8');
    }
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
