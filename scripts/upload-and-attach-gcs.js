#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');
// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  if (!a || !b) return (a||'').length + (b||'').length;
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
    }
  }
  return dp[la][lb];
}

async function main(){
  const selPath = path.join(process.cwd(), 'tmp', 'selected.json');
  if(!fs.existsSync(selPath)) throw new Error('selection file not found: ' + selPath);
  const sel = JSON.parse(fs.readFileSync(selPath,'utf8'));
  // Accept legacy `selected` or `items` keys so callers are resilient
  const items = Array.isArray(sel.selected) ? sel.selected : (Array.isArray(sel.items) ? sel.items : []);
  if(!items.length) { console.log('No items to process'); return; }

  const { uploadFileToGcs } = require('../src/lib/storage-gcs');
  const { createClient } = require('@supabase/supabase-js');
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if(!SUPA_URL || !SUPA_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON) are required');
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

  for(const it of items){
    try{
        // derive slug fallback from title/id
        const slug = it.slug || (it.title && it.title.toString().toLowerCase().replace(/[^a-z0-9]+/g,'-')) || String(it.id);
        // accept optional oldslug or oldslugs array (original source slugs)
        const oldslug = it.oldslug || null;
        let oldslugs = Array.isArray(it.oldslugs) ? it.oldslugs : (oldslug ? [oldslug] : []);
        // If no oldslugs were provided in the selection, try to fetch rough oldslug(s) from DB
        if ((!oldslugs || !oldslugs.length) && (typeof it.id !== 'undefined' || it.slug)) {
          try {
            // Select only the single 'oldslug' column which exists in the schema.
            let q = supa.from('Article').select('oldslug').limit(1);
            if (typeof it.id === 'number' || (typeof it.id === 'string' && /^\d+$/.test(it.id))) {
              q = q.eq('id', Number(it.id));
            } else if (it.slug) {
              q = q.eq('slug', it.slug);
            }
            const { data: rows, error } = await q;
            if (!error && rows && rows.length) {
              const r = rows[0];
              if (r.oldslugs && Array.isArray(r.oldslugs) && r.oldslugs.length) oldslugs = r.oldslugs;
              else if (r.oldslug) oldslugs = [r.oldslug];
              if (oldslugs && oldslugs.length) console.log('Found DB oldslug(s) for', slug, oldslugs);
            }
          } catch (e) { console.warn('Error fetching oldslug from DB for', slug, e && e.message ? e.message : e); }
        }
      const localDir = path.join(process.cwd(), 'tmp', 'images');
      const localFile = path.join(localDir, `${slug}.png`);
      let chosenLocalFile = localFile;
      if(!fs.existsSync(chosenLocalFile)) {
        // Try to find a best-effort match in the images directory
        let files = [];
        try { files = fs.readdirSync(localDir).filter(f => /\.(png|webp|jpe?g)$/i.test(f)); } catch (e) { files = []; }
        // Only match images by exact oldslug basename. Do not fallback to contains/fuzzy/mtime.
        let match = null;
        if (oldslugs && oldslugs.length) {
          for (const os of oldslugs) {
            if (!os) continue;
            const candidate = files.find(f => path.basename(f, path.extname(f)).toLowerCase() === String(os).toLowerCase());
            if (candidate) { match = candidate; break; }
          }
        }
        if (match) {
          chosenLocalFile = path.join(localDir, match);
          console.warn('Using exact oldslug-matched local image for', slug, chosenLocalFile);
        } else {
          // If DB provided oldslugs but no exact file match, try fuzzy match against oldslugs
          if (oldslugs && oldslugs.length && files.length) {
            // compute minimal Levenshtein distance between each filename and any oldslug
            const tokenize = s => (String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
            const scores = files.map(f => {
              const name = path.basename(f, path.extname(f)).toLowerCase();
              let best = { os: null, score: Infinity };
              for (const os of oldslugs) {
                if (!os) continue;
                const osLower = String(os).toLowerCase();
                const s = levenshtein(name, osLower);
                if (s < best.score) best = { os: osLower, score: s };
              }
              // compute token-overlap with the matched oldslug
              const matched = best.os || '';
              const tName = tokenize(name);
              const tOld = tokenize(matched);
              const setName = new Set(tName);
              const setOld = new Set(tOld);
              let inter = 0;
              for (const w of setName) if (setOld.has(w)) inter++;
              const union = new Set([...setName, ...setOld]).size || 1;
              const overlap = inter / union;
              return { f, score: best.score, matchedOldslug: best.os, tokenOverlap: overlap };
            }).sort((a,b)=>a.score-b.score);

            if (scores.length) {
              const best = scores[0];
              const matchedOld = best.matchedOldslug || '';
              const levThreshold = Math.max(2, Math.floor(matchedOld.length * 0.4));
              const overlapThreshold = 0.35; // require ~35% token overlap
              if (best.tokenOverlap >= overlapThreshold) {
                match = best.f;
                chosenLocalFile = path.join(localDir, match);
                console.warn('Using token-overlap fuzzy match for', slug, chosenLocalFile, 'overlap', best.tokenOverlap.toFixed(2));
              } else if (best.score <= levThreshold) {
                match = best.f;
                chosenLocalFile = path.join(localDir, match);
                console.warn('Using Levenshtein fuzzy match for', slug, chosenLocalFile, 'score', best.score, 'threshold', levThreshold);
              } else {
                console.warn('Fuzzy match found but below thresholds for', slug, 'best score=', best.score, 'levThreshold=', levThreshold, 'tokenOverlap=', best.tokenOverlap.toFixed(2));
              }
            }
          } else {
            console.warn('No exact oldslug image match for', slug, 'and no fallback allowed; skipping');
          }
        }
      }
      if(!fs.existsSync(chosenLocalFile)) { console.warn('Local image missing or not permitted to fallback for', slug, chosenLocalFile); continue; }

  // Convert main image to webp (if needed) and upload that as the coverImage
  const sharp = require('sharp');
  const baseName = path.basename(chosenLocalFile, path.extname(chosenLocalFile));
  const webpLocal = path.join(process.cwd(), 'tmp', 'images', `${baseName}.webp`);
  try {
    if (path.extname(chosenLocalFile).toLowerCase() !== '.webp') {
      console.log('Converting', chosenLocalFile, '->', webpLocal);
      await sharp(chosenLocalFile).webp({ quality: 90 }).toFile(webpLocal);
    } else {
      // already webp - copy to webpLocal for a consistent name
      try { fs.copyFileSync(chosenLocalFile, webpLocal); } catch(e) { /* ignore */ }
    }
  } catch (e) {
    console.warn('WebP conversion failed, falling back to original file for upload:', e && e.message ? e.message : e);
    // if conversion failed, fall back to original file
    if (fs.existsSync(webpLocal)) try { fs.unlinkSync(webpLocal); } catch(e){}
  }

  // Choose the file to upload (prefer webpLocal if exists)
  const fileToUpload = fs.existsSync(webpLocal) ? webpLocal : chosenLocalFile;
  const destName = `uploads/${path.basename(fileToUpload)}`;
  console.log('Uploading', fileToUpload, '->', destName);
  const uploadRes = await uploadFileToGcs(fileToUpload, destName, true, process.env.GCS_IMAGE_BUCKET);
      console.log('Upload result:', uploadRes && uploadRes.url);

      // create a thumbnail 96x96 and upload it too (JPEG thumb)
  const thumbName = `uploads/${baseName}-96sq.jpg`;
  const thumbLocal = path.join(process.cwd(), 'tmp', 'images', `${baseName}-96sq.jpg`);
  try {
    await sharp(fileToUpload).resize(96,96,{fit:'cover'}).jpeg({quality:86}).toFile(thumbLocal);
  } catch(e) {
    // fallback: if sharp fails on webp input, try original chosenLocalFile
    try { await sharp(chosenLocalFile).resize(96,96,{fit:'cover'}).jpeg({quality:86}).toFile(thumbLocal); } catch(e2) { console.warn('Thumbnail creation failed', e2 && e2.message ? e2.message : e2); }
  }
      const thumbRes = fs.existsSync(thumbLocal) ? await uploadFileToGcs(thumbLocal, thumbName, true, process.env.GCS_IMAGE_BUCKET) : null;
      console.log('Thumb upload result:', thumbRes && thumbRes.url);

      // attach to Supabase Article row similar to pipeline
      const fullRelRaw = uploadRes && uploadRes.url ? uploadRes.url : `/${destName}`;
      const thumbRelRaw = thumbRes && thumbRes.url ? thumbRes.url : `/${thumbName}`;

      // Trim any querystring or trailing data after the image extension (.webp/.jpg/.jpeg/.png)
      function trimUrlAfterExt(u) {
        if (!u || typeof u !== 'string') return u;
        const m = u.match(/^(.*?\.(?:webp|jpe?g|png))(?:[?#].*)?$/i);
        return m ? m[1] : u;
      }

      const fullRel = trimUrlAfterExt(fullRelRaw);
      const thumbRel = trimUrlAfterExt(thumbRelRaw);

      try{
        // Prevent invalid input syntax errors by ensuring we only pass integers to .eq('id', ...)
        const idVal = it.id;
        let updateQuery = supa.from('Article').update({ coverImage: fullRel, thumbnail: thumbRel });
        let whereDesc = '';
        if (typeof idVal === 'number' || (typeof idVal === 'string' && /^\d+$/.test(idVal))) {
          // numeric id (string digits allowed)
          updateQuery = updateQuery.eq('id', Number(idVal));
          whereDesc = `id=${Number(idVal)}`;
        } else if (oldslugs && oldslugs.length) {
          // match by any provided oldslug(s)
          if (oldslugs.length === 1) {
            updateQuery = updateQuery.eq('oldslug', oldslugs[0]);
            whereDesc = `oldslug=${oldslugs[0]}`;
          } else {
            const clause = oldslugs.map(os => `oldslug.eq.${os}`).join(',');
            updateQuery = updateQuery.or(clause);
            whereDesc = `oldslug in (${oldslugs.join(',')})`;
          }
        } else {
          console.warn('No suitable id or oldslug to match Article row for', JSON.stringify(it), '; skipping DB update');
          continue;
        }

        const { data, error } = await updateQuery.select();
        if(error) console.error('Supabase attach error', JSON.stringify(error));
        else console.log('Supabase attached image for', whereDesc || '(unknown)', fullRel);
      }catch(e){ console.error('Supabase update failed', e && e.message); }

  // cleanup generated thumb and webp temp
  try{ if (fs.existsSync(thumbLocal)) fs.unlinkSync(thumbLocal); }catch(e){}
  try{ if (fs.existsSync(webpLocal)) fs.unlinkSync(webpLocal); }catch(e){}

    }catch(e){ console.error('Error processing', it && (it.id || it.slug), e && e.message ? e.message : e); }
  }
}

if(require.main === module){
  main().catch(e=>{ console.error(e && e.stack?e.stack:e); process.exit(1); });
}

module.exports = { main };
