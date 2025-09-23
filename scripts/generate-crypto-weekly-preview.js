#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getReport } = require('../lib/crypto-weekly');

// optional LLM support (reuse pattern from other scripts)
let fetchFn = null;
try{ fetchFn = require('node-fetch'); }catch(e){ fetchFn = null; }

async function generateNarrativeWithLLM(summary, movers){
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  console.log('LLM model:', model);
  const prompt = `You are a concise market analyst. Given a two-line top-10 summary and arrays of top gainers/losers, produce a JSON object with keys: title (short page title), snapshot (1-2 short sentences), highlights (array up to 6 bullets), headlines (array up to 6 short headlines). Respond with valid JSON only.\n\nsummary: ${String(summary)}\n\nmovers: ${JSON.stringify(movers)}\n\nExample: {"title":"Crypto Weekly Preview: Top-10 snapshot","snapshot":"...","highlights":["..."],"headlines":["..."]}`;
  try{
    if (String(model).toLowerCase().startsWith('gpt-5')){
      const url = 'https://api.openai.com/v1/responses';
      let maxOutput = 300;
      const doRequest = async (maxOutputTokens) => {
        const body = { model, input: prompt, max_output_tokens: maxOutputTokens };
        const res = await (fetchFn ? fetchFn(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) }) : fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) }));
        if(!res || !res.ok){
          const txt = res ? await res.text().catch(()=>'<no body>') : '<no response>';
          console.warn('LLM request failed', res && res.status, txt);
          try{ if(process.env.OPENAI_DEBUG === 'true'){ console.warn('Model used:', model); console.warn('Request body snippet:', JSON.stringify(body).slice(0,2000)); console.warn('Full response body (truncated 8000 chars):', txt && String(txt).slice(0,8000)); } }catch(_){ }
          return null;
        }
        return await res.json();
      };
      let json = await doRequest(maxOutput);
      if (json && json.status === 'incomplete' && json.incomplete_details && json.incomplete_details.reason === 'max_output_tokens'){
        console.warn('LLM response incomplete due to max_output_tokens; retrying with larger max_output_tokens');
        const newMax = Math.min(Math.max(800, maxOutput * 2), 2000);
        json = await doRequest(newMax) || json;
      }
      // If Responses API failed (e.g., 400) return null — fall back to Chat Completions
      if (!json){
        console.warn('Responses API failed or returned no JSON; falling back to Chat Completions');
        try{
          const chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
          const chatUrl = 'https://api.openai.com/v1/chat/completions';
          const chatBody = { model: chatModel, messages:[{role:'system', content:'You are a professional financial market analyst. Be concise and factual.'},{role:'user', content:prompt}], max_tokens:300, temperature:0.0 };
          const chatRes = await (fetchFn ? fetchFn(chatUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(chatBody) }) : fetch(chatUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(chatBody) }));
          if(!chatRes || !chatRes.ok){ const txt = chatRes ? await chatRes.text().catch(()=>'<no body>') : '<no response>'; console.warn('Chat fallback failed', chatRes && chatRes.status, txt); json = null; }
          else json = await chatRes.json();
        }catch(e){ console.warn('Chat fallback failed', e && e.message); json = null; }
      }
      let content = null;
      if (json.output_text) content = json.output_text;
      else if (json.output && Array.isArray(json.output)){
        const parts = [];
        json.output.forEach(o=>{
          if (typeof o === 'string') parts.push(o);
          else if (o.content && Array.isArray(o.content)){
            o.content.forEach(c=>{ if (c.text) parts.push(c.text); else if (typeof c === 'string') parts.push(c); });
          }
        });
        content = parts.join('\n').trim();
      } else if (json.choices && json.choices[0]){
        content = (json.choices[0].message && json.choices[0].message.content) || json.choices[0].text;
      }
      if(!content) return null;
  const m = content.match(/\{[\s\S]*\}/m);
  const jtxt = m ? m[0] : content;
  try{ return JSON.parse(jtxt); }catch(e){
    console.warn('Failed to parse LLM JSON response for preview; raw content follows:\n', jtxt);
    try{ console.warn('Full API JSON:', JSON.stringify(json).slice(0,2000)); }catch(_){}
    // If the response was incomplete (truncated), attempt a lightweight repair by balancing braces/brackets/quotes
    try{
      const repair = (txt)=>{
        // find first JSON object start
        const idx = txt.indexOf('{');
        if(idx === -1) return txt;
        let s = txt.slice(idx);
        // simple counts
        const count = (ch)=> (s.split(ch).length-1);
        const openBr = count('{'); const closeBr = count('}');
        const openSq = count('['); const closeSq = count(']');
        const quotes = count('"');
        // trim trailing incomplete tokens
        s = s.replace(/,\s*\n?\s*$/, '');
        if(quotes % 2 === 1) s = s + '"';
        if(closeSq < openSq) s = s + ']'.repeat(openSq - closeSq);
        if(closeBr < openBr) s = s + '}'.repeat(openBr - closeBr);
        return s;
      };
      const repaired = repair(jtxt);
      return JSON.parse(repaired);
    }catch(e2){
      // final fallback
      return null;
    }
  }
    }else{
      const url = 'https://api.openai.com/v1/chat/completions';
      const body = { model, messages:[{role:'system', content:'You are a professional financial market analyst. Be concise and factual.'},{role:'user', content:prompt}], max_tokens:300, temperature:0.6 };
      const res = await (fetchFn ? fetchFn(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) }) : fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) }));
      if(!res || !res.ok){ const txt = res ? await res.text().catch(()=>'<no body>') : '<no response>'; console.warn('LLM request failed', res && res.status, txt); return null; }
      const json = await res.json();
      const content = json && json.choices && json.choices[0] && (json.choices[0].message && json.choices[0].message.content || json.choices[0].text);
      if(!content) return null;
  const m = content.match(/\{[\s\S]*\}/m);
  const jtxt = m ? m[0] : content;
  try{ return JSON.parse(jtxt); }catch(e){ console.warn('Failed to parse LLM JSON response for preview; raw content follows:\n', jtxt); try{ console.warn('Full API JSON:', JSON.stringify(json).slice(0,2000)); }catch(_){} return null; }
    }
  }catch(e){ console.warn('LLM preview generation failed', e && e.message); return null; }
}

function buildHtml(title, snapshot, highlights, reports, generatedAt){
  const now = generatedAt || new Date().toISOString();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="/reports/report.css" />
</head>
<body>
  <div class="wrapper">
    <div class="title">
      <h1>${title}</h1>
      <div class="muted">Generated: ${now}</div>
    </div>

    <div class="card">
      <h2 class="snapshot-title">Snapshot</h2>
      <p class="muted">${snapshot}</p>
    </div>

    <div class="card">
      <h3 class="section-title">Highlights</h3>
      <ul class="clean">
        ${Array.isArray(highlights) ? highlights.map(h => `<li>${h}</li>`).join('\n') : ''}
      </ul>
    </div>

    <div class="card grid">
      <div>
        <h3 class="section-title">Top-10 movers</h3>
        <ul class="clean">
          ${reports.map(r => `<li><strong>${r.name} (${r.symbol})</strong>: ${r.priceSummary.split('\n')[1] || ''}</li>`).join('\n')}
        </ul>
      </div>

      <aside class="aside">
        <h3 class="section-title">Latest Headlines</h3>
        <ul class="clean">
          ${ (reports.slice(0,6).map((r,i)=>{ const ev = (r.data && r.data.events && r.data.events[0]) ? (r.data.events[0].title || r.data.events[0].headline || r.data.events[0].description || '') : ''; return `<li>${r.name}: ${ev}</li>` }).join('\n')) }
        </ul>
      </aside>
    </div>

    <div class="footer">Generated by Cointist  data from CoinGecko & Binance</div>
  </div>
</body>
</html>`;
}

async function main(){
  try{
    const report = await getReport();
    if(!report || !Array.isArray(report.reports)) throw new Error('No report data');
    const generatedAt = new Date().toISOString();

    // Try to get an LLM-enhanced preview title and highlights
    let previewMeta = null;
    try{
      previewMeta = await generateNarrativeWithLLM(report.summary, report.movers);
      if(previewMeta) console.log('LLM preview used');
      else console.log('LLM preview not available; using deterministic summary');
    }catch(e){ previewMeta = null; }

    const title = (previewMeta && previewMeta.title) ? previewMeta.title : `Crypto Weekly Preview — Top-10 snapshot`;
    const snapshot = (previewMeta && previewMeta.snapshot) ? previewMeta.snapshot : report.summary || '';
    const highlights = (previewMeta && Array.isArray(previewMeta.highlights) && previewMeta.highlights.length) ? previewMeta.highlights : (report.reports.slice(0,5).map(r => `${r.name}: ${r.signals && typeof r.signals.change === 'number' ? `${r.signals.change.toFixed(2)}%` : ''}`));
    const headlines = (previewMeta && Array.isArray(previewMeta.headlines) && previewMeta.headlines.length) ? previewMeta.headlines : (report.reports.slice(0,6).map(r => (r.data && r.data.events && r.data.events[0] && (r.data.events[0].title || r.data.events[0].headline || r.data.events[0].description)) || ''));

    const html = buildHtml(title, snapshot, highlights, report.reports, generatedAt);

    const latest = {
      generatedAt,
      title,
      snapshot,
      highlights,
      headlines,
      // include the full per-report `data` so the preview page can use snapshot/chronology/etc.
      reports: report.reports.map(r => ({
        id: r.id,
        name: r.name,
        symbol: r.symbol,
        priceSummary: r.priceSummary,
        signals: r.signals,
        metrics: r.metrics,
        // preserve any computed narrative pieces and events
        data: r.data || {},
        // keep top-level events for convenience too
        events: (r.data && r.data.events) ? r.data.events : (r.events || [])
      }))
    };

    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    if(!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const nowShort = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const outFile = path.join(reportsDir, `crypto-weekly-preview-${nowShort}.html`);
    const latestJsonFile = path.join(reportsDir, `crypto-weekly-preview-latest.json`);
    const latestHtmlFile = path.join(reportsDir, `crypto-weekly-preview-latest.html`);

    fs.writeFileSync(outFile, html, 'utf8');
    fs.writeFileSync(latestJsonFile, JSON.stringify(latest, null, 2), 'utf8');
    fs.writeFileSync(latestHtmlFile, html, 'utf8');

    console.log('Wrote preview HTML to', outFile);
    console.log('Wrote latest JSON to', latestJsonFile);
    console.log('Wrote latest HTML to', latestHtmlFile);

  }catch(e){
    console.error('Preview generator failed', e && e.message);
    process.exit(1);
  }
}

main();
