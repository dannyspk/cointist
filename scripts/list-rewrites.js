const fs = require('fs');
const path = require('path');

function collectStaticPageRewrites() {
  const pagesDir = path.join(process.cwd(), 'public', 'pages');
  const rewrites = [];
  if (!fs.existsSync(pagesDir)) return rewrites;

  function walk(dir, base = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) { walk(path.join(dir, e.name), path.posix.join(base, e.name)); continue; }
      if (!e.name.toLowerCase().endsWith('.html')) continue;
      const rel = path.posix.join(base, e.name);
      let route = ('/' + rel).replace(/\.html$/i, '');
      route = route.replace(/\\/g, '/');
      if (route.endsWith('/index')) route = route.replace(/\/index$/, '');
      if (route === '') route = '/';
      const destination = '/pages/' + rel;
      const nameOnly = path.posix.basename(rel, '.html');
      const nextStatic = path.join(process.cwd(), 'pages', 'static', nameOnly + '.jsx');
      const nextPageJsx = path.join(process.cwd(), 'pages', nameOnly + '.jsx');
      const nextPageTsx = path.join(process.cwd(), 'pages', nameOnly + '.tsx');
      const nextPageIndex = path.join(process.cwd(), 'pages', nameOnly, 'index.jsx');
      const handledByNext = fs.existsSync(nextStatic) || fs.existsSync(nextPageJsx) || fs.existsSync(nextPageTsx) || fs.existsSync(nextPageIndex);
      rewrites.push({ route, destination, handledByNext });
    }
  }

  walk(pagesDir, '');
  return rewrites;
}

const list = collectStaticPageRewrites();
console.log('Found rewrites:');
for (const r of list) {
  console.log(r.route.padEnd(20), '->', r.destination.padEnd(40), 'handledByNext:', r.handledByNext);
}
