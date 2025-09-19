#!/usr/bin/env node
// Normalize advanced guide HTML files in a folder.
// - Remove admin-generated "Contents" lists (h3.articleH3 + following <ol> or nav.toc)
// - Remove <nav class="toc"> or <aside class="toc"> blocks embedded in article
// - Fix simple nested <h2> patterns where an <h2> wraps another <h2>
// Usage: node normalize-advanced-folder.js --dir="C:\path\to\folder" [--apply]

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function usage(){
  console.log('Usage: node scripts/normalize-advanced-folder.js --dir="C:\\path\\to\\folder" [--apply]');
  process.exit(1);
}

const args = process.argv.slice(2);
let dir = null;
let apply = false;
let singleFile = null;
let verbose = false;
for (let i=0;i<args.length;i++){
  const a = args[i];
  if(a.startsWith('--dir=')) dir = a.split('=')[1];
  else if(a === '--dir') dir = args[i+1], i++;
  else if(a.startsWith('--file=')) singleFile = a.split('=')[1];
  else if(a === '--file') singleFile = args[i+1], i++;
  else if(a === '--apply' || a === '--yes') apply = true;
  else if(a === '--verbose' || a === '-v') verbose = true;
}

if(!dir && !singleFile) usage();

let files = [];
if(singleFile){
  if(!fs.existsSync(singleFile) || !fs.statSync(singleFile).isFile()){
    console.error('File not found:', singleFile);
    process.exit(1);
  }
  files = [singleFile];
} else {
  if(!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()){
    console.error('Directory not found:', dir);
    process.exit(1);
  }
  files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.html')).map(f => path.join(dir, f));
}
if(!files.length){
  console.log('No .html files found in', dir);
  process.exit(0);
}

function removeContentsAndToc($, filePath){
  const article = $('article').first();
  // If the file is a fragment without an <article>, operate on <body> or the root
  const root = (article && article.length) ? article : ($('body').length ? $('body') : $.root());
  if(!root || !root.length) return { changed:false, reasons: {} };
  let changed = false;
  const reasons = { hasContents:false, hasToc:false, hasNestedH2:false, hasKeytakeaways:false };

  // Remove h3.articleH3 with text 'Contents' and its following <ol>
  root.find('h3.articleH3').each((i, el) => {
    const txt = $(el).text().trim().toLowerCase();
    if(txt === 'contents'){
      reasons.hasContents = true;
      const next = $(el).next();
      if(next && next.is('ol')){ next.remove(); }
      $(el).remove();
      changed = true;
    }
  });

  // Remove <nav class="toc"> or <aside class="toc"> inside article
  root.find('nav.toc, aside.toc, .toc').each((i, el) => {
    const node = $(el);
    // Heuristic: if it contains an ordered list or the word 'contents', remove it
    const hasOl = node.find('ol').length > 0;
    const text = (node.text() || '').toLowerCase();
    if(hasOl || text.includes('contents')){ node.remove(); changed = true; reasons.hasToc = true; }
  });

  // Fix nested <h2> patterns like: <h2 id="x" class="prose">\n  <h2 class="articleH2">Title</h2>\n  <p>...</p>\n</h2>
  // We'll use a DOM pass: find any h2 that contains another h2; replace the outer
  // with a new proper h2 (merging id) and keep remaining children as siblings.
  // Fix nested h2 patterns anywhere inside the selected root
  root.find('h2').each((i, el) => {
    const innerH2 = $(el).find('h2').first();
    if(innerH2 && innerH2.length){
      reasons.hasNestedH2 = true;
      const outer = $(el);
      const inner = innerH2;
      const outerId = outer.attr('id');
      const innerHtml = inner.html() || '';
      const innerClass = inner.attr('class') || 'articleH2';
      const newIdAttr = outerId ? ` id="${outerId}"` : '';
      const newH2 = `<h2${newIdAttr} class="${innerClass}">${innerHtml}</h2>`;

      // collect other children (excluding the inner h2) to append after the new h2
      let rest = '';
      outer.contents().each((idx, node) => {
        if(node.type === 'tag' && node.tagName === 'h2') return; // skip inner h2
        rest += $.html(node);
      });

      outer.replaceWith(newH2 + rest);
      changed = true;
    }
  });

  // Convert any <h2 class="keytakeaways">... with nested h3 to a <section>
  root.find('h2.keytakeaways').each((i, el) => {
    reasons.hasKeytakeaways = true;
    const html = $(el).html();
    const replacement = `<section class="keytakeaways">${html}</section>`;
    $(el).replaceWith(replacement);
    changed = true;
  });

  return { changed, reasons };
}

let will = [];
let did = [];

files.forEach(fpath => {
  const filePath = fpath;
  const raw = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(raw, { decodeEntities: false });
  const before = $.html();
  const { changed, reasons } = removeContentsAndToc($, filePath);
  const after = $.html();
  if(verbose){
    console.log('\nFile:', filePath);
    console.log('  hasContents:', reasons.hasContents);
    console.log('  hasToc:', reasons.hasToc);
    console.log('  hasNestedH2:', reasons.hasNestedH2);
    console.log('  hasKeytakeaways:', reasons.hasKeytakeaways);
  }
  if(changed && before !== after){
    if(!apply){ will.push(filePath); }
    else {
      // backup then write
      const bak = filePath + '.bak';
      try{ fs.copyFileSync(filePath, bak, fs.constants.COPYFILE_EXCL); }catch(e){}
      fs.writeFileSync(filePath, after, 'utf8');
      did.push(filePath);
    }
  }
});

if(!apply){
  if(will.length){
    console.log('WILL UPDATE - the following files would be modified:');
    will.forEach(f => console.log('  ' + f));
    console.log('\nRun with --apply to write changes. Backups (.bak) will be created for each file.');
  } else {
    console.log('No changes needed.');
  }
} else {
  if(did.length){
    did.forEach(f => console.log('UPDATED - ' + f));
    console.log('\nDone. ' + did.length + ' file(s) modified. Backups saved with .bak suffix.');
  } else {
    console.log('No files required updates.');
  }
}
