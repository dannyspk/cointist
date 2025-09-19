#!/usr/bin/env node
// Fix a single HTML fragment or file: remove Contents/toc blocks and un-nest nested H2s
// Usage: node scripts/fix-single-fragment.js --file="C:\path\to\file.html" [--apply]

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const args = process.argv.slice(2);
let file = null;
let apply = false;
for(let i=0;i<args.length;i++){
  const a = args[i];
  if(a.startsWith('--file=')) file = a.split('=')[1];
  else if(a === '--file') file = args[i+1], i++;
  else if(a === '--apply' || a === '--yes') apply = true;
}
if(!file){ console.error('Usage: --file="C:\\path\\to\\file.html" [--apply]'); process.exit(1); }
if(!fs.existsSync(file)){ console.error('File not found:', file); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8');
const $ = cheerio.load(raw, { decodeEntities: false });
const article = $('article').first();
const root = (article && article.length) ? article : ($('body').length ? $('body') : $.root());
if(!root || !root.length){ console.error('No root found in file'); process.exit(1); }

let changed = false;

// Remove Contents header + following ol if present
root.find('h3.articleH3').each((i, el) => {
  const txt = $(el).text().trim().toLowerCase();
  if(txt === 'contents'){
    const next = $(el).next();
    if(next && next.is('ol')) next.remove();
    $(el).remove(); changed = true;
  }
});

// Remove embedded nav.toc or aside.toc
root.find('nav.toc, aside.toc, .toc').each((i, el) => {
  const node = $(el);
  const hasOl = node.find('ol').length > 0;
  const text = (node.text()||'').toLowerCase();
  if(hasOl || text.includes('contents')){ node.remove(); changed = true; }
});

// Find any h2 elements that contain a nested h2 and un-nest them
root.find('h2').each((i, el) => {
  const $el = $(el);
  const inner = $el.find('h2').first();
  if(inner && inner.length){
    const outerId = $el.attr('id');
    const innerClass = inner.attr('class') || 'articleH2';
    // inner may contain title text and more; prefer text-only for title
    const titleText = inner.text().trim();
    const newH2 = `<h2${outerId ? ` id="${outerId}"` : ''} class="${innerClass}">${titleText}</h2>`;

    // collect siblings inside outer except the inner h2
    let rest = '';
    $el.contents().each((idx, node) => {
      if(node.type === 'tag' && node.tagName === 'h2') return; // skip inner h2
      rest += $.html(node);
    });

    $el.replaceWith(newH2 + rest);
    changed = true;
  }
});

// keytakeaways h2 -> section
root.find('h2.keytakeaways').each((i, el) => {
  const html = $(el).html();
  $(el).replaceWith(`<section class="keytakeaways">${html}</section>`);
  changed = true;
});

if(!changed){
  console.log('No changes detected for', file);
  process.exit(0);
}

if(!apply){
  console.log('Changes WOULD be applied to', file, '\nRun with --apply to write changes and create a .bak');
  process.exit(0);
}

// write backup and file
const bak = file + '.bak';
try{ fs.copyFileSync(file, bak, fs.constants.COPYFILE_EXCL); }catch(e){}
fs.writeFileSync(file, $.html(), 'utf8');
console.log('UPDATED', file, '\nBackup created:', bak);
process.exit(0);
