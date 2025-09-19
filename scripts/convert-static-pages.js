const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'public', 'pages');
const outDir = path.join(__dirname, '..', 'pages');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

function extractMain(html) {
  // crude approach: remove head section and capture content from first <main to </main>
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) return mainMatch[0];
  // fallback: find first <body> and last </body>
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (bodyMatch) return bodyMatch[0];
  // if nothing found, return full html
  return html;
}

for (const file of files) {
  const name = path.basename(file, '.html');
  // skip index.html and index-wired.html to avoid conflict
  if (name === 'index' || name === 'index-wired') continue;
  const raw = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const main = extractMain(raw);
  // Remove existing topbar/header/footer and mobile menu HTML fragments if present
  let cleaned = main.replace(/<div class="topbar-socials"[\s\S]*?<\/div>/i, '');
  cleaned = cleaned.replace(/<header[\s\S]*?<\/header>/i, '');
  cleaned = cleaned.replace(/<nav id="mobile-menu"[\s\S]*?<\/nav>/i, '');
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/i, '');
  // Normalize asset paths that are relative (assets/foo.png -> /assets/foo.png)
  cleaned = cleaned.replace(/src=\"assets\//g, 'src="/assets/');
  cleaned = cleaned.replace(/src='assets\//g, "src='/assets/");
  // Replace common .html links with clean routes
  cleaned = cleaned.replace(/href=\"about\.html\"/g, 'href="/about"');
  cleaned = cleaned.replace(/href=\"contact\.html\"/g, 'href="/contact"');
  cleaned = cleaned.replace(/href=\"advertise\.html\"/g, 'href="/advertise"');
  cleaned = cleaned.replace(/href=\"newsletter\.html\"/g, 'href="/newsletter"');
  cleaned = cleaned.replace(/href=\"editorial-policy\.html\"/g, 'href="/editorial-policy"');
  cleaned = cleaned.replace(/href=\"privacy\.html\"/g, 'href="/privacy"');
  cleaned = cleaned.replace(/href=\"terms\.html\"/g, 'href="/terms"');
  cleaned = cleaned.replace(/href=\"index-wired\.html\"/g, 'href="/"');
  cleaned = cleaned.replace(/href=\"index\.html\"/g, 'href="/"');
  cleaned = cleaned.replace(/href=\"news\.html\"/g, 'href="/news"');
  cleaned = cleaned.replace(/href=\"reviews\.html\"/g, 'href="/reviews"');
  cleaned = cleaned.replace(/href=\"guides\.html\"/g, 'href="/guides"');
  cleaned = cleaned.replace(/href=\"analysis\.html\"/g, 'href="/analysis"');
  cleaned = cleaned.replace(/href=\"opinion\.html\"/g, 'href="/opinion"');
  // Ensure stylesheet links in main (rare) are root-relative
  cleaned = cleaned.replace(/href=\"cointist\.css\"/g, 'href="/styles/cointist.css"');
  cleaned = cleaned.replace(/href=\"cointist-wire-menu\.css\"/g, 'href="/styles/cointist-wire-menu.css"');
  const outFile = path.join(outDir, `${name}.jsx`);
  const jsx = `import React from 'react';
  import SiteFooter from '../src/components/SiteFooter';

export default function Static${name.replace(/[^a-zA-Z0-9]/g, '_')}() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(cleaned)} }} />
      <SiteFooter />
    </>
  );
}
`;
  fs.writeFileSync(outFile, jsx, 'utf8');
  console.log('wrote', outFile);
}

console.log('done');
