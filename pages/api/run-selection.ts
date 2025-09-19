import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.ids ? [body.ids] : [];
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'No ids provided' });

    const filePath = path.join(process.cwd(), 'tmp', 'trending-aggregator-last.json');
    let articles = [] as any[];
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      articles = JSON.parse(raw) || [];
    } catch (e) {
      // if file not found, return error
      return res.status(500).json({ error: 'Could not read aggregator file', detail: String(e) });
    }

  const selected = articles.filter(a => a && ids.includes(a.id));
  // helper to derive a usable slug for article link if one isn't present
  const makeSlug = (it: any) => {
    if (!it) return '';
    if (it.slug) return String(it.slug);
    if (it.url) {
      try {
        const u = new URL(it.url);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length) {
          const last = parts[parts.length - 1];
          return String(last).replace(/\.[a-z0-9]{1,6}$/i, '').replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
        }
      } catch(e) { /* ignore URL parse errors */ }
    }
    const t = (it.title || it.id || '') + '';
    return t.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,80) || String(it.id || 'article');
  }
  // attach slug, oldSlug and href for downstream UI/pipeline convenience
  const selectedWithHref = selected.map(s => {
    const slug = makeSlug(s);
    // prefer an explicit original slug if the article provides one (preserve original source slug)
    const explicitOld = s.slug && String(s.slug) !== String(slug) ? String(s.slug) : undefined;
    // ensure both camelCase oldSlug and lowercase oldslug are present for different consumers
    const oldSlug = explicitOld || slug;
    const oldslug = (explicitOld || slug).toString();
    return Object.assign({}, s, { slug, oldSlug, oldslug, href: `/articles/${slug}` });
  });
  if (!selected || selected.length === 0) return res.status(400).json({ error: 'No matching articles found for provided ids' });
  // quick sanity: ensure each selected item has a URL
  const missingUrl = selected.find(s => !s || !s.url);
  if (missingUrl) return res.status(400).json({ error: 'One or more selected items are missing a URL' });
    // write selection to tmp/selection-to-pipeline.json for downstream pipeline to consume
    const outPath = path.join(process.cwd(), 'tmp', 'selection-to-pipeline.json');
    try {
      fs.writeFileSync(outPath, JSON.stringify({ selected: selectedWithHref, generatedAt: new Date().toISOString() }, null, 2), 'utf8');
    } catch (e) {
      return res.status(500).json({ error: 'Could not write selection file', detail: String(e) });
    }

    // If there's a project daily pipeline script, prefer running it
    const pipelineScript = path.join(process.cwd(), 'scripts', 'full-daily-pipeline.js');
  // record an invocation file so the UI can confirm the pipeline was requested
  const invokedAt = Date.now();
  const invocationPath = path.join(process.cwd(), 'tmp', `pipeline-invocation-${invokedAt}.json`);
  // create a unique token for this invocation so downstream summary writers can
  // include it and the frontend can reliably match the summary to this run.
  const invocationToken = crypto.randomBytes(10).toString('hex');
      try {
      if (!fs.existsSync(path.dirname(invocationPath))) fs.mkdirSync(path.dirname(invocationPath), { recursive: true });
  fs.writeFileSync(invocationPath, JSON.stringify({ startedAt: invokedAt, invocationToken, selected: selectedWithHref.map(s=>({ id: s.id, title: s.title, url: s.url, slug: s.slug, oldSlug: s.oldSlug || null, href: s.href })), note: 'pipeline invocation created before spawning process' }, null, 2), 'utf8');
    } catch (e) {
      console.error('Could not write invocation file', String(e));
    }

    // Also append a short header to the global pipeline run log files so the UI's pipeline-log
    // endpoint can pick up this invocation even if individual child processes write separate logs.
    try {
      const TMP = path.join(process.cwd(), 'tmp');
      const preferredLog = path.join(TMP, 'pipeline-run-output.txt');
      const fallbackLog = path.join(TMP, 'pipeline-run.log');
  const header = `Queued ${Array.isArray(selectedWithHref) ? selectedWithHref.length : 0} item(s). Waiting for pipeline to finish... (invocation: ${invocationPath}) token=${invocationToken}\n`;
      try { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true }); } catch (e) {}
      try { fs.appendFileSync(preferredLog, header, 'utf8'); } catch (e) {}
      try { fs.appendFileSync(fallbackLog, header, 'utf8'); } catch (e) {}
    } catch (e) {
      // ignore logging errors
    }

  // Instead of running the full pipeline, spawn fetch-and-dump per selected article.
  // This writes extracted article content to tmp/ and (optionally) upserts via the script.
  try {
    const fetchScript = path.join(process.cwd(), 'scripts', 'fetch_and_dump.js');
    if (fs.existsSync(fetchScript)) {
      for (const s of selectedWithHref) {
        try {
          const safe = String(s.id || s.slug || '').replace(/[^a-z0-9\-]/gi, '_').slice(0, 80) || String(Date.now());
          const outFilePath = path.join(process.cwd(), 'tmp', `source-for-rephrase-${safe}.txt`);
          const logPath = path.join(process.cwd(), 'tmp', `fetch_and_dump_${safe}.log`);
          try { if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), { recursive: true }); } catch(e) {}
          const header = `\n=== Spawned fetch_and_dump for ${s.id || s.url} at ${new Date().toISOString()} script=${process.execPath} ${fetchScript} --url=${s.url} --out=${outFilePath} invocation=${invocationPath} ===\n`;
          try { fs.appendFileSync(logPath, header, 'utf8'); } catch(e) {}
          // spawn node to run the script
          const child = spawn(process.execPath, [fetchScript, `--url=${s.url}`, `--out=${outFilePath}`], { cwd: process.cwd(), windowsHide: true });
          child.stdout.on('data', d => { try { fs.appendFileSync(logPath, String(d), 'utf8') } catch(e) {} });
          child.stderr.on('data', d => { try { fs.appendFileSync(logPath, String(d), 'utf8') } catch(e) {} });
          child.on('error', err => { try { fs.appendFileSync(logPath, `\n=== child error=${String(err)} at ${new Date().toISOString()} ===\n`, 'utf8') } catch(e) {} });
          child.on('close', code => { try { fs.appendFileSync(logPath, `\n=== child exit code=${code} at ${new Date().toISOString()} ===\n`, 'utf8') } catch(e) {} });
        } catch (e) {
          console.error('Failed to spawn fetch_and_dump for', s && s.id, String(e));
        }
      }
    } else {
      console.warn('fetch_and_dump.js not found; no per-article fetch performed');
    }
  } catch (e) {
    console.error('Error while spawning fetch_and_dump processes', String(e));
  }

  // include a startedAt timestamp so the UI can poll for a pipeline-summary newer than this
  // Use the invocation time as the start marker; do NOT artificially set it earlier than
  // existing summary mtimes (that caused the UI to immediately match stale summaries).
  const startedAt = (typeof invokedAt === 'number' && invokedAt > 20) ? invokedAt : Date.now();

  // include slugs and ids for the client to reliably match pipeline summaries to this run
  const slugs = selectedWithHref.map(s => s.slug || '');
  const idsOut = selectedWithHref.map(s => s.id || '');
  return res.status(200).json({ ok: true, count: selected.length, out: outPath, startedAt, invocation: fs.existsSync(invocationPath) ? invocationPath : null, slugs, ids: idsOut, token: invocationToken });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
