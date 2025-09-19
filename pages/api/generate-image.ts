import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import util from 'util'
import path from 'path'

// Defensive require: if the generator module throws during import (missing fetch or deps), capture it to tmp immediately.
let generateArticleImage: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../scripts/generate-article-image.js')
  generateArticleImage = mod && mod.generateArticleImage ? mod.generateArticleImage : mod
} catch (impErr) {
  try {
    const outDir = path.join(process.cwd(), 'tmp')
    fs.mkdirSync(outDir, { recursive: true })
    const logPath = path.join(outDir, 'generate-image-error.log')
  const ie: any = impErr
  const entry = `${new Date().toISOString()} [generate-image] IMPORT ERROR: ${String(ie && ie.message ? ie.message : ie)}\n${ie && ie.stack ? ie.stack : ''}\n\n`
    // write synchronously to avoid async issues during server error handling
    fs.appendFileSync(logPath, entry, 'utf8')
  } catch (silent) {
    // best-effort only
    try { console.error('Failed to write import error log', silent) } catch (e) {}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  // Early debug: append a short, synchronous entry indicating route invocation and incoming body size
  try {
    const dbgPath = path.join(process.cwd(), 'tmp', 'generate-image-debug.log')
    const hdr = `${new Date().toISOString()} [generate-image] called method=${req.method} url=${req.url} contentLength=${req.headers['content-length'] || 'unknown'}\n`
    fs.appendFileSync(dbgPath, hdr, 'utf8')
  } catch (dbgErr) {
    try { console.error('Failed to write early debug log', dbgErr) } catch (e) {}
  }
  try {
  const { slug, title, excerpt, summary, style, model, size, prompt, referenceUrl, engine, id } = req.body || {}
    // Require that the pipeline has produced `tmp/selected.json` and that the pipeline has completed
    // before allowing UI-triggered image generation. This avoids picking selection-derived titles
    // while the pipeline is still running and ensures behavior matches how pipeline results load.
    const selCheckPath = path.join(process.cwd(), 'tmp', 'selected.json')
    if (!fs.existsSync(selCheckPath)) {
      // 409 Conflict indicates caller should wait for pipeline/selection to finish
      return res.status(409).json({ error: 'Selection not ready', detail: 'tmp/selected.json not found. Wait for pipeline to finish and selected.json to be written, then retry.' })
    }
    // Read and parse the selection file and require an explicit "ready/finished" signal
    // or a clearly populated items array before proceeding. This is defensive because
    // tmp/selected.json may be present early while the pipeline is still producing results.
    let selRawCheck: string | null = null
    let selJsonCheck: any = null
    let selReady = false
    try {
      selRawCheck = await fs.promises.readFile(selCheckPath, 'utf8')
      selJsonCheck = JSON.parse(selRawCheck)
      // Common conventions: ready === true, finished === true, completed === true, status === 'done'
      if (selJsonCheck && (selJsonCheck.ready === true || selJsonCheck.finished === true || selJsonCheck.completed === true || selJsonCheck.status === 'done')) {
        selReady = true
      } else {
        // Fallback: consider completed if items array exists and appears populated with meaningful fields
        const itemsArr = Array.isArray(selJsonCheck.items) ? selJsonCheck.items : (Array.isArray(selJsonCheck) ? selJsonCheck : [])
        if (itemsArr.length > 0) {
          // simple heuristic: each item should have at least one of title/slug/id
          const good = itemsArr.every((it: any) => it && (it.title || it.slug || typeof it.id !== 'undefined'))
          if (good) selReady = true
        }
      }
    } catch (e) {
      // If parsing fails, treat as not ready so caller will retry
      selReady = false
    }
    if (!selReady) {
      return res.status(409).json({ error: 'Selection not ready', detail: 'tmp/selected.json present but pipeline not finished. Retry after pipeline completes.' })
    }
    if (!title && !slug) return res.status(400).json({ error: 'Missing title or slug' })
  // Prefer slug from tmp/selected.json when available (rephraser/selection-derived slug)
  let finalSlug: string | undefined = slug
  try {
    const selPath = path.join(process.cwd(), 'tmp', 'selected.json')
    if (fs.existsSync(selPath)) {
      try {
        const selRaw = await fs.promises.readFile(selPath, 'utf8')
        const selJson = JSON.parse(selRaw)
        const selItems = Array.isArray(selJson.items) ? selJson.items : (Array.isArray(selJson) ? selJson : [])
        const normalize = (s: any) => (s ? String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '') : '')
        const targetTitleNorm = normalize(title)
        for (const it of selItems) {
          try {
            const itTitle = it.title || it.fields?.title || it.data?.title || ''
            const itSlug = it.slug || it.fields?.slug || it.data?.slug || ''
            const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : null
            if (itSlug && itSlug === slug) { finalSlug = itSlug; break }
            if (id && itId && String(id) === itId) { finalSlug = itSlug || finalSlug; break }
            if (targetTitleNorm && normalize(itTitle) === targetTitleNorm) { finalSlug = itSlug || finalSlug; break }
          } catch (e) { /* ignore per-item parse errors */ }
        }
      } catch (e) { /* ignore parse/read errors */ }
    }
  } catch (e) { /* best-effort only */ }

  // Prefer selected title when available; fall back to incoming title
  let finalTitle: string | undefined = title
  try {
    const selPath2 = path.join(process.cwd(), 'tmp', 'selected.json')
    if (fs.existsSync(selPath2)) {
      try {
        const selRaw2 = await fs.promises.readFile(selPath2, 'utf8')
        const selJson2 = JSON.parse(selRaw2)
        const selItems2 = Array.isArray(selJson2.items) ? selJson2.items : (Array.isArray(selJson2) ? selJson2 : [])
        const normalize2 = (s: any) => (s ? String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '') : '')
        const targetTitleNorm2 = normalize2(title)
        for (const it of selItems2) {
          try {
            const itTitle = it.title || it.fields?.title || it.data?.title || ''
            const itSlug = it.slug || it.fields?.slug || it.data?.slug || ''
            const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : null
            if (itSlug && itSlug === slug) { finalTitle = itTitle || finalTitle; break }
            if (id && itId && String(id) === itId) { finalTitle = itTitle || finalTitle; break }
            if (targetTitleNorm2 && normalize2(itTitle) === targetTitleNorm2) { finalTitle = itTitle || finalTitle; break }
          } catch (e) { /* ignore per-item parse errors */ }
        }
      } catch (e) { /* ignore parse/read errors */ }
    }
  } catch (e) { /* best-effort only */ }

  const article = { slug: finalSlug || slug, title: finalTitle || title, excerpt, summary, referenceUrl }
  // Canonical slug and title to use across all downstream image generation code paths
  // Force selection: if tmp/selected.json exists and contains items, prefer its matching item
  try {
    const selPathForce = path.join(process.cwd(), 'tmp', 'selected.json')
    if (fs.existsSync(selPathForce)) {
      try {
        const selRawForce = await fs.promises.readFile(selPathForce, 'utf8')
        const selJsonForce = JSON.parse(selRawForce)
        const selItemsForce = Array.isArray(selJsonForce.items) ? selJsonForce.items : (Array.isArray(selJsonForce.selected) ? selJsonForce.selected : (Array.isArray(selJsonForce) ? selJsonForce : []))
        const normalizeF = (s: any) => (s ? String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '') : '')
        const targetNorm = normalizeF(title || slug || '')
        let matched: any = null
        for (const it of selItemsForce) {
          try {
            const itSlug = it.slug || it.fields?.slug || it.data?.slug || ''
            const itTitle = it.title || it.fields?.title || it.data?.title || ''
            const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : null
            if (itId && id && String(id) === itId) { matched = it; break }
            if (itSlug && itSlug === slug) { matched = it; break }
            if (targetNorm && normalizeF(itTitle) === targetNorm) { matched = it; break }
          } catch (e) { /* ignore */ }
        }
        // If no match but selection is a single item, use it
        if (!matched && selItemsForce.length === 1) matched = selItemsForce[0]
        if (matched) {
          try {
            const itSlug = matched.slug || matched.fields?.slug || matched.data?.slug || ''
            const itTitle = matched.title || matched.fields?.title || matched.data?.title || ''
            if (itSlug) finalSlug = itSlug
            if (itTitle) finalTitle = itTitle
          } catch (_) {}
        }
      } catch (_) { /* ignore parse errors */ }
    }
  } catch (_) { /* best-effort */ }

  const usedSlug = finalSlug || slug || ''
  const usedTitle = finalTitle || title || ''
    // Generate image to tmp/images/<slug>.png (script default)
  const useResponses = engine ? (engine === 'responses') : true
  // If Gemini image model requested, call Google's Generative Images REST API using GEMINI_API_KEY
  let result: any = null
  let srcPath = ''
  if (model === 'gemini-image-1') {
    // Prefer SDK when service-account / ADC are present or when explicitly requested
    const useSdk = (process.env.USE_VERTEX_SDK === '1') || !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GOOGLE_CLOUD_PROJECT
    if (useSdk) {
      try {
        // Lazy require to avoid adding runtime penalty when not used
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GoogleGenAI, Modality } = require('@google/genai')
        const project = process.env.GOOGLE_CLOUD_PROJECT
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
        const ai = new GoogleGenAI({ vertexai: true, project, location })
  const promptText = prompt || `${usedTitle || usedSlug}\n\n${excerpt || summary || ''}`.trim()
        const stream = await ai.models.generateContentStream({
          model: process.env.GENAI_MODEL || 'gemini-2.0-flash-exp',
          contents: promptText,
          config: { responseModalities: [Modality.IMAGE] },
        })

        const outDir = path.join(process.cwd(), 'tmp', 'images')
        await fs.promises.mkdir(outDir, { recursive: true })
        let imageIndex = 0
        let writtenPath: string | null = null
        for await (const chunk of stream) {
          const data = (chunk as any).data
          if (data && data instanceof Uint8Array) {
      const outName = `${(usedSlug || title || 'article').replace(/[^a-z0-9\-]/ig, '-')}-${Date.now()}-${imageIndex++}.png`
            const outPath = path.join(outDir, outName)
            await fs.promises.writeFile(outPath, Buffer.from(data))
            writtenPath = outPath
            break // take first image
          }
        }
    if (!writtenPath) return res.status(502).json({ error: 'SDK did not return image data' })
  result = { outPath: writtenPath, slug: usedSlug || title, title: usedTitle || title, model: 'gemini-image-1', via: 'vertex-sdk' }
        srcPath = result.outPath
      } catch (e: any) {
        // log and fall through to REST fallback if available
        try {
          const outDir = path.join(process.cwd(), 'tmp')
          await fs.promises.mkdir(outDir, { recursive: true })
          const header = `${new Date().toISOString()} [generate-image] SDK ERROR: ${String(e?.message || e)}\n${e?.stack || ''}\n`;
          await fs.promises.appendFile(path.join(outDir, 'generate-image-error.log'), header, 'utf8')
          // append a verbose dump of the error (captures response payloads)
          try {
            const dump = util.inspect(e, { depth: 6, maxArrayLength: 50 });
            await fs.promises.appendFile(path.join(outDir, 'generate-image-error.log'), `SDK ERROR DUMP:\n${dump}\n\n`, 'utf8')
          } catch (_) {
            // ignore inspect failures
          }
        } catch (_) {}
        // continue to REST fallback below
      }
    }

    // REST fallback (API key) - keep existing behavior
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    if (!srcPath && !key) return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable and SDK not configured' })
    if (!srcPath) {
      try {
        // Build prompt from provided fields
  const promptText = prompt || `${usedTitle || usedSlug}\n\n${excerpt || summary || ''}`.trim();
        const body = {
          model: process.env.GENAI_MODEL || 'gemini-2.0-flash-exp',
          prompt: { text: promptText },
          image: { mimeType: 'image/png' },
          width: (size || '').split('x')[0] ? Number((size || '1024x1024').split('x')[0]) : undefined,
          height: (size || '').split('x')[1] ? Number((size || '1024x1024').split('x')[1]) : undefined,
        } as any
        const fetchRes = await fetch('https://generativelanguage.googleapis.com/v1/images:generate?key=' + encodeURIComponent(key), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!fetchRes.ok) {
          const txt = await fetchRes.text().catch(() => '')
          return res.status(502).json({ error: 'Gemini image API error', status: fetchRes.status, body: txt })
        }
        const jr = await fetchRes.json().catch(() => ({} as any))
        const b64 = jr?.data?.[0]?.b64 || jr?.candidates?.[0]?.image?.b64 || jr?.b64 || jr?.image?.b64 || null
        if (!b64) return res.status(502).json({ error: 'Gemini image API did not return base64 image', raw: jr })
        const outDir = path.join(process.cwd(), 'tmp', 'images')
        await fs.promises.mkdir(outDir, { recursive: true })
  const outName = `${(usedSlug || title || 'article').replace(/[^a-z0-9\-]/ig, '-')}-${Date.now()}.png`
        const outPath = path.join(outDir, outName)
        const buf = Buffer.from(b64, 'base64')
        await fs.promises.writeFile(outPath, buf)
  result = { outPath, slug: usedSlug || title, title: usedTitle || title, model: 'gemini-image-1', via: 'gemini' }
        srcPath = outPath
      } catch (e: any) {
        return res.status(500).json({ error: 'Gemini image generation failed', detail: e?.message || String(e) })
      }
    }
  } else {
    result = await generateArticleImage(article, { model, size, style, useResponses, prompt, referenceUrl })
    srcPath = String(result?.outPath || '')
    // Ensure result contains canonical title/slug so downstream code can rely on them
    try {
      result = result || {}
      result.title = result.title || usedTitle || title
      result.slug = result.slug || usedSlug || slug
    } catch (_) { /* best-effort */ }
  }
    if (!srcPath || !fs.existsSync(srcPath)) return res.status(500).json({ error: 'Image generation did not produce a file' })
    // Validate file size; if empty/too small, retry once using Images API directly with b64_json
    try {
      const st = await fs.promises.stat(srcPath)
      if (!st || st.size < 1024) {
        // retry
        result = await generateArticleImage(article, { model: 'gpt-image-1', size, style, useResponses: false, response_format: 'b64_json', prompt })
        srcPath = String(result?.outPath || srcPath)
      }
    } catch {}
    // Ensure non-empty after retry
    try {
      const st2 = await fs.promises.stat(srcPath)
      if (!st2 || st2.size < 1024) {
        return res.status(502).json({ error: 'Generated image appears empty after retry', tmpPath: srcPath })
      }
    } catch {
      return res.status(500).json({ error: 'Failed to stat generated image', tmpPath: srcPath })
    }
    // Copy to public for static serving
  const pubDir = path.join(process.cwd(), 'public', 'assets', 'generated')
    await fs.promises.mkdir(pubDir, { recursive: true })
  // Normalize slug for filename: prefer result.slug (already seeded), then usedSlug (selection), then fallback
  const pickSlug = String(result?.slug || usedSlug || 'article')
  const fileSlug = pickSlug.replace(/[^a-z0-9\-]/ig, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'article'
  const baseName = `${fileSlug}-${Date.now()}.png`
    const destPath = path.join(pubDir, baseName)
    await fs.promises.copyFile(srcPath, destPath)
  const url = `/assets/generated/${baseName}`
    // Append a short line to tmp/pipeline-run-output.txt for visibility
    try {
      const outDir = path.join(process.cwd(), 'tmp')
      await fs.promises.mkdir(outDir, { recursive: true })
  const logLine = `${new Date().toISOString()} [generate-image] slug=${fileSlug} title=${result.title || usedTitle || title} srcPath=${srcPath} -> ${url}\n`
      await fs.promises.appendFile(path.join(outDir, 'pipeline-run-output.txt'), logLine, 'utf8')
      // Also write a metadata JSON next to the public file so the association is explicit
      try {
        const meta = {
          slug: fileSlug,
          title: result.title || usedTitle || title,
          model: result.model || null,
          via: result.via || null,
          tmpPath: srcPath || null,
          createdAt: new Date().toISOString(),
        }
        const metaPath = path.join(pubDir, `${baseName}.json`)
        await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8')
      } catch (metaErr) {
        // ignore metadata write failures
      }
    } catch {}
  return res.status(200).json({ ok: true, url, slug: result.slug || slug, title: result.title || usedTitle || title, model: result.model, via: result.via, tmpPath: srcPath })
  } catch (e: any) {
    try {
      // append full stack to tmp log for offline inspection
      const outDir = path.join(process.cwd(), 'tmp');
      await fs.promises.mkdir(outDir, { recursive: true });
      const logPath = path.join(outDir, 'generate-image-error.log');
      const entry = `${new Date().toISOString()} [generate-image] ERROR: ${String(e?.message || e)}\n${e?.stack || ''}\n\n`;
      await fs.promises.appendFile(logPath, entry, 'utf8');
    } catch (err) {
      // ignore logging errors
      console.error('Failed to write error log', err);
    }
    console.error('generate-image handler error:', e);
    try {
      return res.status(500).json({ error: e?.message || 'Image generation failed' });
    } catch (_) {
      // If sending JSON fails, ensure we don't crash
      res.statusCode = 500;
      res.end('Internal Server Error');
      return;
    }
  }
}
