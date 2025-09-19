const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

function plainToHtml(text){
  if (!text) return '';
  // Normalize CRLF
  const norm = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  let lines = norm.split('\n');
  // If content is a single very long paragraph (no newlines), try to split into sentences
  // and regroup into shorter paragraphs for readability.
  if (lines.length === 1 && lines[0].length > 300) {
    const single = lines[0].trim();
    // Basic sentence splitter: split on punctuation that likely ends a sentence.
    const sentences = single.split(/(?<=[\.\?\!])\s+(?=[A-Z0-9"'\(])/g).map(s=>s.trim()).filter(Boolean);
    // Group sentences into paragraphs of 2-4 sentences (prefer 3)
    const grouped = [];
    const size = 3;
    for (let i=0;i<sentences.length;i+=size){
      grouped.push(sentences.slice(i,i+size).join(' '));
    }
    lines = grouped;
  }
  const out = [];
  let inList = false;
  let listType = null;
  for (let raw of lines){
    const line = raw.trim();
    if (!line){
      if (inList){ out.push(`</${listType}>`); inList=false; listType=null; }
      continue;
    }
    // ATX-style headings
    if (/^#{1,4}\s+/.test(line)){
      const level = Math.min(4, (line.match(/^#+/)||[])[0].length);
      const txt = line.replace(/^#{1,4}\s+/, '');
      out.push(`<h${level}>${escapeHtml(txt)}</h${level}>`);
      continue;
    }
    // Heuristic: short line that looks like a heading (title-case, short, no trailing punctuation)
    // Treat this as an H2. This also works for lines produced by the sentence-splitting step.
    if (line.length > 0 && line.length <= 120 && line.split('\t').join(' ').split(' ').length <= 10 && !/[.?!:]$/.test(line) && /^[A-Z0-9]/.test(line)){
      out.push(`<h2>${escapeHtml(line)}</h2>`);
      continue;
    }
    // blockquote marker: lines starting with >
    if (line.startsWith('>')){
      const txt = line.replace(/^>\s?/, '');
      out.push(`<blockquote>${escapeHtml(txt)}</blockquote>`);
      continue;
    }
    // unordered list marker
    if (/^[-*]\s+/.test(line)){
      if (!inList){ inList = true; listType='ul'; out.push('<ul>'); }
      const item = line.replace(/^[-*]\s+/, '');
      out.push(`<li>${escapeHtml(item)}</li>`);
      continue;
    }
    // numbered list
    if (/^\d+\.\s+/.test(line)){
      if (!inList){ inList = true; listType='ol'; out.push('<ol>'); }
      const item = line.replace(/^\d+\.\s+/, '');
      out.push(`<li>${escapeHtml(item)}</li>`);
      continue;
    }
    // paragraph — detect pullquote first
    const pq = detectPullquote(line);
    if (pq) {
      const quoted = (/^["“”'']/.test(pq) || /["“”'']$/.test(pq)) ? pq : `"${pq}"`;
      out.push(`<blockquote class="pullquote">${escapeHtml(quoted)}</blockquote>`);
      continue;
    }
    // convert inline markdown and auto-link URLs
    const converted = convertInlineMarkdown(line);
    out.push(`<p>${converted}</p>`);
  }
  if (inList){ out.push(`</${listType}>`); }
  return out.join('\n');
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function autoLink(text){
  return String(text).replace(/((https?:\/\/|www\.)[^\s<]+)/g, (m)=>{
    const href = m.startsWith('www.') ? 'http://' + m : m;
    return `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(m)}</a>`;
  });
}

function convertInlineMarkdown(s){
  // operate on escaped input to avoid accidental HTML injection
  let out = escapeHtml(s);
  // bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic via _italic_ or *italic*
  out = out.replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<em>$2</em>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // autolink URLs
  out = autoLink(out);
  return out;
}

function detectPullquote(line){
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Only treat as a pullquote in clear cases:
  // - line both starts and ends with quotation marks (common for quoted pullquotes),
  //   and is reasonably long (>=40 chars), OR
  // - line starts with an em dash (—) which authors sometimes use for pullquotes,
  //   and is reasonably long (>=60 chars).
  // This avoids treating every ordinary paragraph as a pullquote.
  if (/^[\"\u201c\u201d']/.test(trimmed) && /[\"\u201c\u201d']$/.test(trimmed) && trimmed.length >= 40) {
    return trimmed.replace(/^[\"\u201c\u201d']|[\"\u201c\u201d']$/g,'');
  }
  if (/^\u2014|^\u2013|^\-/.test(trimmed) && trimmed.length >= 60) {
    // treat em-dash, en-dash, or leading hyphen as a possible pullquote marker
    return trimmed.replace(/^[\u2014\u2013\-]+\s*/, '');
  }
  return null;
}

async function main(){
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const dry = args.includes('--dry');
  const idArg = args.find(a => a.startsWith('--id='));
  const idsArg = args.find(a => a.startsWith('--ids='));

  const cmsFile = path.resolve(process.cwd(), '.cms.json');
  if (!fs.existsSync(cmsFile)) { console.error('.cms.json missing; cannot sign admin token'); process.exit(1); }
  const cms = JSON.parse(fs.readFileSync(cmsFile,'utf8'));
  const token = jwt.sign({user: cms.username||'admin'}, cms.jwtSecret, { expiresIn: '1h' });
  const cookie = `cms_token=${token}; Path=/; HttpOnly`;

  const base = process.env.BASE_URL || 'http://localhost:3000';
  const ids = [];

  if (idArg) {
    const v = idArg.split('=')[1];
    const n = Number(v);
    if (!Number.isNaN(n)) ids.push(n);
  }
  if (idsArg) {
    const list = idsArg.split('=')[1] || '';
    list.split(',').map(s=>s.trim()).filter(Boolean).forEach(s=>{ const n=Number(s); if(!Number.isNaN(n)) ids.push(n) });
  }

  if (all){
    // iterate pages until we've fetched all articles
    let page = 1; const pageSize = 40;
    while (true){
      const res = await fetch(base + '/api/articles?' + new URLSearchParams({ page:String(page), pageSize: String(pageSize) }));
      if (!res.ok) { console.error('Failed to list articles', await res.text()); process.exit(1); }
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data || []);
      if (!list.length) break;
      list.forEach(a=> ids.push(a.id));
      if (list.length < pageSize) break;
      page++;
    }
  } else {
    // fetch recent latest News articles
    const res = await fetch(base + '/api/articles?' + new URLSearchParams({ category: 'News', subcategory: 'latest', page: '1', pageSize: '20' }));
    if (!res.ok) { console.error('Failed to list articles', await res.text()); process.exit(1); }
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : (json.data || []);
    list.forEach(a=> ids.push(a.id));
  }

  console.log(`Found ${ids.length} articles to inspect (dry=${dry})`);

  for (const id of ids){
    try{
      const r = await fetch(base + '/api/articles/' + id);
      if (!r.ok){ console.error('Failed to GET', id); continue }
      const art = await r.json();
      const content = art.content || '';
      // If content contains HTML, check if it's a single <p> wrapper with plaintext inside.
      // If so, extract inner text and re-run the plaintext-to-HTML conversion. Otherwise skip.
      let html = null;
      const singleP = String(content).trim().match(/^<p>([\s\S]*)<\/p>\s*$/i);
      // If content already contains structured tags, skip. Otherwise extract text and convert.
      const hasStructured = /<h[1-6]|<blockquote|<ul|<ol|<figure|<table/i.test(content);
      if (hasStructured) {
        console.log('Skipping', id, '- already has structured HTML');
        continue;
      }

      let textForConversion = null;
      if (singleP) {
        const inner = singleP[1];
        // If inner has no other HTML tags, use it raw; otherwise strip tags and use text
        if (!/[<][a-zA-Z\/!]/.test(inner)) textForConversion = inner;
        else textForConversion = inner.replace(/<[^>]+>/g, ' ');
      } else if (/^\s*<[^>]+>/.test(content)) {
        // Contains tags but no structured elements: strip tags and convert text
        textForConversion = content.replace(/<[^>]+>/g, ' ');
      } else {
        // No HTML tags at all — convert full content
        textForConversion = content;
      }

      // Normalize and feed into plainToHtml
      html = plainToHtml(String(textForConversion || '').replace(/\s+/g,' ').trim());
      if (dry){
        console.log('DRY:', id, html.slice(0,300).replace(/\n/g,' '));
        continue;
      }
      const payload = Object.assign({}, art, { content: html });
      for (const k of Object.keys(payload)) if (payload[k] === undefined) payload[k] = null;
      const put = await fetch(base + '/api/articles/' + id, { method: 'PUT', headers: { 'Content-Type':'application/json', 'Cookie': cookie }, body: JSON.stringify(payload) });
      const txt = await put.text();
      if (!put.ok) console.error('PUT failed for', id, put.status, txt);
      else console.log('Updated article', id);
    }catch(e){ console.error('Error for', id, e.message) }
  }
}

main().catch(e=>{ console.error(e); process.exit(1) });
