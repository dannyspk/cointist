// Batch-convert pages in a GitBook space to local Markdown files
// - Lists space content via /v1/spaces/{space}/content
// - For each page, fetches the public HTML using the page path
// - Extracts main <article> ... </aside class="related"> section when available
// - Replaces PDprotocol -> PDP, removes footer blocks, converts to Markdown
// - Writes files to docs/gitbook/space-<spaceId>/<slug-or-id>.md

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

function readEnv(envPath) {
  if (!fs.existsSync(envPath)) throw new Error('.gitbook.env not found');
  const raw = fs.readFileSync(envPath, 'utf8');
  const obj = {};
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) obj[m[1]] = m[2];
  });
  return obj;
}

function getContent(spaceId, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.gitbook.com',
      path: `/v1/spaces/${encodeURIComponent(spaceId)}/content`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(url, res => {
        const status = res.statusCode;
        const location = res.headers && res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          // Resolve relative redirects
          const next = new URL(location, u).toString();
          // Follow redirect
          resolve(fetchUrl(next, maxRedirects - 1));
          return;
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: status, body: data, url: url }));
      });
      req.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function collectPages(pages, out = []) {
  pages.forEach(p => {
    out.push(p);
    if (Array.isArray(p.pages) && p.pages.length) collectPages(p.pages, out);
  });
  return out;
}

function extractMainHtml(html) {
  // Use JSDOM to parse and try to extract <article> ... related aside end marker
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const article = doc.querySelector('article');
  if (article) return article.innerHTML;

  // fallback: use main content selector used in GitBook
  const main = doc.querySelector('main');
  if (main) return main.innerHTML;

  // last fallback: body
  return doc.body.innerHTML;
}

function stripFooter(md) {
  // Remove lines starting with **Previous:**, **Next:**, _Last updated:, _Source:
  const lines = md.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].trim();
    if (L.startsWith('**Previous:') || L.startsWith('**Next:') || L.startsWith('_Last updated:') || L.startsWith('_Source:')) {
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

async function main() {
  try {
    const env = readEnv(path.resolve(__dirname, '..', '.gitbook.env'));
    const token = env.GITBOOK_TOKEN; const space = env.GITBOOK_SPACE_ID;
    if (!token) throw new Error('GITBOOK_TOKEN not found in .gitbook.env');
    if (!space) throw new Error('GITBOOK_SPACE_ID not found in .gitbook.env');

    console.log(`Listing pages for space ${space}...`);
    const res = await getContent(space, token);
    if (!res || !Array.isArray(res.pages)) throw new Error('Unexpected API response');

  const outDir = path.resolve(__dirname, '..', 'docs', 'gitbook', `space-${space}`);
    ensureDir(outDir);
    const turndown = new TurndownService({ codeBlockStyle: 'fenced' });

  // Allow a manual override for the public site URL (useful when the Content API response lacks site.url)
  const envSite = env.GITBOOK_SITE_URL && env.GITBOOK_SITE_URL.trim() ? env.GITBOOK_SITE_URL.trim() : null;
  const baseSiteHost = envSite || (res.site && res.site.url ? res.site.url : null); // e.g. paydax.gitbook.io

    // Collect pages into a flat list so we can process sequentially and reliably
    const pages = collectPages(res.pages);
    for (const p of pages) {
      const pageId = p.id;
      const slug = p.slug || slugify(p.title || pageId);
  let pagePath = p.path || null;

      // Build a safe public URL. Rules:
      // - If pagePath is an absolute http(s) URL, use it.
      // - Else if site.url is present and pagePath starts with '/', build https://{site.url}{pagePath}.
      // - Otherwise skip the page (do NOT guess using the space id as a hostname).
      let publicUrl = null;
      try {
        if (pagePath && /^https?:\/\//i.test(pagePath)) {
          publicUrl = pagePath;
        } else if (baseSiteHost && pagePath) {
          // ensure leading slash
          if (!pagePath.startsWith('/')) pagePath = '/' + pagePath;
          publicUrl = `https://${baseSiteHost}${pagePath}`;
        } else if (!pagePath && p.slug && baseSiteHost) {
          // fallback: use slug as a path when no explicit path is provided
          publicUrl = `https://${baseSiteHost}/${p.slug}`;
        } else {
          console.log(`Skipping ${pageId} (${p.title || ''}) — no usable public path or site.url to build a URL`);
          continue;
        }

        // Guard: ensure the resulting URL belongs to the same site (avoid fetching other spaces)
        if (baseSiteHost) {
          const u = new URL(publicUrl);
          if (u.hostname !== baseSiteHost) {
            console.log(`Skipping ${pageId} — public URL host (${u.hostname}) does not match space site (${baseSiteHost})`);
            continue;
          }
        }

        console.log(`Fetching ${publicUrl} ...`);
        const fetched = await fetchUrl(publicUrl);
        if (fetched.status !== 200) {
          console.log(`  -> ${fetched.status} for ${fetched.url || publicUrl}, skipping`);
          continue;
        }

        // Validate the final hostname matches the base site host (if provided)
        if (baseSiteHost) {
          try {
            const finalHost = new URL(fetched.url || publicUrl).hostname;
            if (finalHost !== baseSiteHost) {
              console.log(`  -> Final host ${finalHost} does not match expected ${baseSiteHost}, skipping`);
              continue;
            }
          } catch (e) {
            console.log(`  -> Could not parse final URL ${fetched.url || publicUrl}, skipping`);
            continue;
          }
        }

        let mainHtml = extractMainHtml(fetched.body);
        if (!mainHtml || !mainHtml.trim()) {
          console.log(`  -> No main HTML found for ${pageId}, skipping`);
          continue;
        }

        // Replace PDprotocol -> PDP
        mainHtml = mainHtml.replace(/PDprotocol/g, 'PDP');

        // Convert to markdown
        const mdBody = turndown.turndown(mainHtml);
        const cleaned = stripFooter(mdBody);

        const fileName = `${slug || pageId}.md`;
        const outPath = path.join(outDir, fileName);
        const front = `---\ntitle: "${p.title || slug}"\n---\n\n`;
        fs.writeFileSync(outPath, front + cleaned, 'utf8');
        console.log(`  -> Wrote ${outPath}`);
      } catch (err) {
        console.error(`  -> Error processing ${pageId}:`, err.message || err);
      }
    }

    console.log('Done. Markdown files saved under', outDir);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) main();
