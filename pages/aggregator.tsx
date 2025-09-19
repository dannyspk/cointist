import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GetServerSideProps } from 'next';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import he from 'he';
import fetch from 'node-fetch';

interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  stems?: string[];
  numId?: number; // sequential numeric id (1-based) assigned server-side for UI selection
}

interface AggregatorProps {
  articles: Article[];
  topKeywords: { key: string; label: string; count: number; score?: number; type?: 'unigram'|'bigram'|'trigram' }[];
  mostFrequent?: { key: string; label: string; count: number }[];
  hoursUsed?: number;
}

const AggregatorPage: React.FC<AggregatorProps> = ({ articles, topKeywords, mostFrequent, hoursUsed }) => {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [keywordFilter, setKeywordFilter] = useState(''); // stores normalized stem/phrase
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  // support multiple selected ids (user can enter indexes like "2,5,21" or paste ids)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionInput, setSelectionInput] = useState('');
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(null);
  const [pipelineSummary, setPipelineSummary] = useState<any | null>(null);
  const [pipelineLogLines, setPipelineLogLines] = useState<string[]>([]);
  const [resolvedPreview, setResolvedPreview] = useState<Article[]>([]);
  const logTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);
  const expectedSlugsRef = useRef<string[] | null>(null);
  const expectedIdsRef = useRef<string[] | null>(null);
  const expectedCountRef = useRef<number | null>(null);
  const expectedTokenRef = useRef<string | null>(null);
  const [runProgress, setRunProgress] = useState<Record<string, 'queued'|'running'|'done'|'failed'>>({});
  const [lastSummaryKeys, setLastSummaryKeys] = useState<{ slugs: string[]; titles: string[]; urls: string[]; ids?: string[] } | null>(null);
  const [debugOpen, setDebugOpen] = useState<Record<string, boolean>>({});
  const [fastVerify] = useState<boolean>(true);
  const runProgressRef = useRef<Record<string, 'queued'|'running'|'done'|'failed'>>({});
  useEffect(() => { runProgressRef.current = runProgress; }, [runProgress]);
  const fastTimerRef = useRef<any>(null);
  const resolvedMetaRef = useRef<Record<string, { id: number | null; excerpt?: string; coverImage?: string }>>({});
  const exportedRef = useRef<boolean>(false);
  const [genImg, setGenImg] = useState<Record<string, string>>({});
  const [genBusy, setGenBusy] = useState<Record<string, boolean>>({});
  const [attachBusy, setAttachBusy] = useState<Record<string, boolean>>({});
  const [attachConfirm, setAttachConfirm] = useState<Record<string, boolean>>({});
  const [genPrompt, setGenPrompt] = useState<Record<string, string>>({});
  // preview of selection-derived slug/title returned by pipeline-status pre-flight check
  const [selectionPreview, setSelectionPreview] = useState<Record<string, { slug?: string; title?: string } | null>>({});
  // batch image generation state
  const [batchGenActive, setBatchGenActive] = useState<boolean>(false);
  const [batchGenProgress, setBatchGenProgress] = useState<number>(0);
  const cancelBatchRef = useRef<boolean>(false);
  // global image settings
  const [imgEngine, setImgEngine] = useState<'auto'|'responses'|'images'>(() => (typeof window !== 'undefined' && localStorage.getItem('img.engine') as any) || 'auto');
  const [imgModel, setImgModel] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('img.model')) || 'auto');
  const [imgSize, setImgSize] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('img.size')) || '1024x1024');
  const [imgStyle, setImgStyle] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('img.style')) || 'photo');
  const [imgStyleCustom, setImgStyleCustom] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('img.style.custom')) || '');
  // image panel filtering & selection
  const [imgFilterMode, setImgFilterMode] = useState<'all'|'noimg'|'hasimg'|'done'|'failed'>('all');
  const [imgFilterQuery, setImgFilterQuery] = useState<string>('');
  const [imgSel, setImgSel] = useState<Record<string, boolean>>({});
  const [selectionItems, setSelectionItems] = useState<any[] | null>(null);
  const selectionMapRef = useRef<Record<string, any>>({});

  // persist and load settings/prompts
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('gen.prompt.map') : null;
      if (saved) setGenPrompt(JSON.parse(saved));
    } catch {}
  }, []);

  
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('gen.prompt.map', JSON.stringify(genPrompt)); } catch {} }, [genPrompt]);
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('img.engine', imgEngine); } catch {} }, [imgEngine]);
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('img.model', imgModel); } catch {} }, [imgModel]);
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('img.size', imgSize); } catch {} }, [imgSize]);
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('img.style', imgStyle); } catch {} }, [imgStyle]);
  useEffect(() => { try { if (typeof window !== 'undefined') localStorage.setItem('img.style.custom', imgStyleCustom); } catch {} }, [imgStyleCustom]);

  async function generateImageForId(cid: string, prompt?: string) {
    const a = (articles || []).find(x => x && x.id === cid);
    if (!a) return;
    const slug = slugifyTitle(a.title || '');
    // include id so server can match selection and prefer selection-derived slug/title
    // Try to fetch latest selection item for this cid so we can send selection-provided slug/title/excerpt
    try {
      const sel = await fetchSelectionItemForCid(cid);
      if (sel) {
        const sslug = sel.slug || sel.fields?.slug || sel.data?.slug || slug;
        const stitle = sel.title || sel.fields?.title || sel.data?.title || a.title || slug;
        const sexcerpt = sel.excerpt || sel.summary || sel.fields?.excerpt || sel.data?.excerpt || a.summary || '';
  var payload: any = { id: a.id, slug: sslug, title: stitle, excerpt: sexcerpt };
  if (sel && sel.oldslug) payload.oldslug = sel.oldslug;
  if (sel && Array.isArray(sel.oldslugs) && sel.oldslugs.length) payload.oldslugs = sel.oldslugs;
      } else {
  var payload: any = { id: a.id, slug, title: a.title || slug, excerpt: a.summary || '' };
  const cached = selectionMapRef.current && selectionMapRef.current[cid] ? selectionMapRef.current[cid] : null;
  if (cached && cached.oldslug) payload.oldslug = cached.oldslug;
  if (cached && Array.isArray(cached.oldslugs) && cached.oldslugs.length) payload.oldslugs = cached.oldslugs;
      }
    } catch (_) {
      var payload: any = { id: a.id, slug, title: a.title || slug, excerpt: a.summary || '' };
    }
    // include a custom prompt and a reference to the last generated image (if any)
    const existingUrl = genImg[cid];
    if (prompt && String(prompt).trim()) payload.prompt = String(prompt).trim();
    if (existingUrl) payload.referenceUrl = existingUrl;
    // model/engine/size/style wiring
    if (imgSize) payload.size = imgSize;
    const styleToSend = imgStyle === 'custom' ? imgStyleCustom : imgStyle;
    if (styleToSend) payload.style = styleToSend;
    if (imgModel && imgModel !== 'auto') payload.model = imgModel;
    if (imgEngine && imgEngine !== 'auto') payload.engine = imgEngine; // 'responses' or 'images'
    setGenBusy(prev => ({ ...prev, [cid]: true }));
    try {
      // Ensure the server-side selection is ready for this id before attempting generation.
      const ready = await ensureSelectionReadyForId(cid);
      if (!ready) {
        setActionStatus('Pipeline selection not ready for this item. Try again later.');
        return;
      }
      // Attempt the POST, but if server responds 409 (selection not ready), poll/retry with backoff
      let attempt = 0;
      const maxAttempts = 12;
      let delayMs = 1000; // initial backoff
      while (attempt < maxAttempts) {
        try {
          const r = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j && j.url) {
            setGenImg(prev => ({ ...prev, [cid]: String(j.url) }));
            break;
          }
          if (r.status === 409) {
            // server indicates selection not ready; honor Retry-After if provided
            const ra = r.headers.get ? r.headers.get('Retry-After') : null;
            let waitMs = 0;
            if (ra) {
              const n = Number(ra);
              if (!isNaN(n) && n > 0) waitMs = n * 1000;
            }
            if (!waitMs) waitMs = delayMs;
            // exponential backoff growth
            delayMs = Math.min(Math.floor(delayMs * 1.6), 15000);
            attempt++;
            await new Promise(res => setTimeout(res, waitMs));
            continue; // retry
          }
          // other non-OK response
          setActionStatus(`Image generation failed: ${j && j.error ? j.error : r.statusText}`);
          break;
        } catch (e: any) {
          // network/runtime error - stop retrying
          setActionStatus(`Image generation error: ${e?.message || String(e)}`);
          break;
        }
      }
      if (attempt >= maxAttempts) {
        setActionStatus('Image generation timed out waiting for pipeline selection. Try again later.');
      }
    } finally {
      setGenBusy(prev => ({ ...prev, [cid]: false }));
    }
  }

  // Pre-flight check: query pipeline-status for the most recent summary and attempt
  // to match a selection item for the given client id. If matched, store a small
  // preview (slug/title) in state so the UI can display it before generation.
  async function preflightSelectionForId(cid: string): Promise<boolean> {
    try {
      const a = (articles || []).find(x => x && x.id === cid);
      const t = a ? (a.title || '') : '';
      const slug = slugifyTitle(t || '');
      const norm = normalizeTitle(t || '');
      const q = new URL('/api/pipeline-status', location.origin);
      // ask for latest run
      const r = await fetch(q.toString(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!r || !r.ok) {
        setSelectionPreview(prev => ({ ...prev, [cid]: null }));
        return false;
      }
  const jj = await r.json().catch(() => ({} as any));
  const items = (jj && jj.summary && Array.isArray(jj.summary.items)) ? jj.summary.items : [];
      // try to find matching item by slug, id, or normalized title
      for (const it of items) {
        try {
          const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
          const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
          const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
          if (itSlug && itSlug === slug) {
            setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } }));
            return true;
          }
          if (a && itId && (String(a.id) === itId || String((a as any).numId) === itId)) {
            setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } }));
            return true;
          }
          const itNorm = normalizeTitle(itTitle || '');
          if (itNorm && norm && itNorm === norm) {
            setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } }));
            return true;
          }
        } catch (_) { /* ignore per-item parse errors */ }
      }
      // no match in pipeline summary — as a fallback try selection-status (tmp/selected.json)
      try {
        const r2 = await fetch('/api/selection-status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (r2 && r2.ok) {
          const j2 = await r2.json().catch(() => ({} as any));
          const selItems = Array.isArray(j2.items) ? j2.items : [];
          for (const it of selItems) {
            try {
              const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
              const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
              const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
              if (itSlug && itSlug === slug) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); return true; }
              if (itId && a && (String(a.id) === itId || String((a as any).numId) === itId)) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); return true; }
              if (itTitle && norm && normalizeTitle(itTitle) === norm) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); return true; }
            } catch (_) {}
          }
        }
      } catch (_) {}
      setSelectionPreview(prev => ({ ...prev, [cid]: null }));
      return false;
    } catch (e) {
      setSelectionPreview(prev => ({ ...prev, [cid]: null }));
      return false;
    }
  }

  // Ensure selection is ready on server for a given client id.
  // Polls /api/selection-status until either the selection is marked ready or a matching
  // item is present for the article. Returns true when ready/matched, false on timeout.
  async function ensureSelectionReadyForId(cid: string, timeoutMs = 60000, intervalMs = 1000): Promise<boolean> {
    const a = (articles || []).find(x => x && x.id === cid);
    const slug = slugifyTitle(a?.title || '');
    const norm = normalizeTitle(a?.title || '');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const r = await fetch('/api/selection-status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (r && r.ok) {
          const j = await r.json().catch(() => ({} as any));
          // Accept explicit ready flag
          if (j && (j.ready === true || j.finished === true || j.completed === true || j.status === 'done')) return true;
          const items = Array.isArray(j.items) ? j.items : [];
          for (const it of items) {
            try {
              const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
              const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
              const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
              if (itSlug && itSlug === slug) return true;
              if (itId && a && (String(a.id) === itId || String((a as any).numId) === itId)) return true;
              if (itTitle && norm && normalizeTitle(itTitle) === norm) return true;
            } catch (_) {}
          }
        }
      } catch (_) {}
      await new Promise(res => setTimeout(res, intervalMs));
    }
    return false;
  }

  // Try to fetch a selection item for the given client id. Prefer the cached
  // selectionMapRef entry if present; otherwise query /api/selection-status and
  // attempt to match by slug, numeric id, or normalized title. Returns the
  // raw selection item or null when no match.
  async function fetchSelectionItemForCid(cid: string): Promise<any | null> {
    try {
      const cached = selectionMapRef.current && selectionMapRef.current[cid] ? selectionMapRef.current[cid] : null;
      if (cached) return cached;
      const r = await fetch('/api/selection-status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!r || !r.ok) return null;
      const j = await r.json().catch(() => ({} as any));
      const items = Array.isArray(j.items) ? j.items : [];
      const a = (articles || []).find(x => x && x.id === cid);
      const slug = slugifyTitle(a?.title || '');
      const norm = normalizeTitle(a?.title || '');
      for (const it of items) {
        try {
          const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
          const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
          const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
          if (itSlug && itSlug === slug) return it;
          if (a && itId && (String(a.id) === itId || String((a as any).numId) === itId)) return it;
          if (itTitle && norm && normalizeTitle(itTitle) === norm) return it;
        } catch (_) { /* ignore per-item parse errors */ }
      }
    } catch (_) {}
    return null;
  }

  async function attachImageToGcsForId(cid: string) {
    const a = (articles || []).find(x => x && x.id === cid);
    if (!a) return;
    const slug = slugifyTitle(a.title || '');
    setAttachBusy(prev => ({ ...prev, [cid]: true }));
    try {
      // Try to include selection-specified slug/title/excerpt when possible
      let payload: any;
      try {
        const sel = await fetchSelectionItemForCid(cid);
        if (sel) {
          const sslug = sel.slug || sel.fields?.slug || sel.data?.slug || slug;
          const stitle = sel.title || sel.fields?.title || sel.data?.title || a.title || slug;
          const sexcerpt = sel.excerpt || sel.summary || sel.fields?.excerpt || sel.data?.excerpt || a.summary || '';
          payload = { id: a.id, slug: sslug, title: stitle, excerpt: sexcerpt };
          if (sel.oldslug) payload.oldslug = sel.oldslug;
          if (Array.isArray(sel.oldslugs) && sel.oldslugs.length) payload.oldslugs = sel.oldslugs;
        } else {
          payload = { id: a.id, slug, title: a.title || slug, excerpt: a.summary || '' };
          const cached = selectionMapRef.current && selectionMapRef.current[cid] ? selectionMapRef.current[cid] : null;
          if (cached && cached.oldslug) payload.oldslug = cached.oldslug;
          if (cached && Array.isArray(cached.oldslugs) && cached.oldslugs.length) payload.oldslugs = cached.oldslugs;
        }
      } catch (_) {
        payload = { id: a.id, slug, title: a.title || slug, excerpt: a.summary || '' };
      }
      const r = await fetch('/api/attach-selected', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(()=>({}));
      if (r.ok && j && j.ok) {
        setActionStatus(`Attached ${slug} -> ${j.outPath || 'GCS'}`);
      } else {
        setActionStatus(`Attach failed: ${j && j.error ? j.error : r.statusText}`);
      }
    } catch (e:any) {
      setActionStatus(`Attach error: ${e?.message || String(e)}`);
    } finally {
      setAttachBusy(prev => ({ ...prev, [cid]: false }));
    }
  }

  // (moved below, after confirmIds/isRunningSelection state declarations)

  async function generateAllForSelection() {
    try {
      const selected = Object.keys(imgSel || {}).filter(id => imgSel[id]);
      const target = selected.length ? selected : (filteredImgIds.length ? filteredImgIds : (confirmIds || []));
      if (!target || !target.length) return;
      if (batchGenActive) return;
      setBatchGenActive(true);
      setBatchGenProgress(0);
      cancelBatchRef.current = false;
    for (let i = 0; i < target.length; i++) {
        if (cancelBatchRef.current) break;
        const cid = target[i];
        try {
      // ensure selection ready for this item before generating
      const ready = await ensureSelectionReadyForId(cid);
      if (ready) await generateImageForId(cid, genPrompt[cid]);
        } catch (e) {
          // continue with next item on error
        }
        setBatchGenProgress(i + 1);
      }
    } finally {
      setBatchGenActive(false);
    }
  }

  // Helpers to robustly match items returned by the pipeline summary
  function slugifyTitle(input: string): string {
    try {
      if (!input) return '';
      let s = String(input)
        // normalize unicode to split accents
        .normalize('NFKD')
        // remove diacritics
        .replace(/[\u0300-\u036f]/g, '')
        // convert curly quotes/apostrophes to plain
        .replace(/[’‘‛′]/g, "'")
        .replace(/[“”״]/g, '"')
        // lower-case
        .toLowerCase();
      // remove quotes entirely, replace non-alphanum with dash, collapse dashes
      s = s.replace(/["']/g, '')
           .replace(/[^a-z0-9]+/g, '-')
           .replace(/-+/g, '-')
           .replace(/^-|-$/g, '');
      return s;
    } catch {
      return '';
    }
  }

  function normalizeTitle(input: string): string {
    try {
      if (!input) return '';
      return String(input)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return '';
    }
  }

  function normalizeUrl(u: string): string {
    try {
      if (!u) return '';
      const b = String(u).split('?')[0].replace(/\/$/, '');
      return b.toLowerCase();
    } catch {
      return '';
    }
  }
  async function runSelection(ids: string[]) {
    if (!ids || ids.length === 0) return;
    setIsRunningSelection(true);
    setActionStatus('Queuing selection...');
    setPipelineSummary(null);
  setPipelineLogLines([]);
    exportedRef.current = false;
    resolvedMetaRef.current = {};
    // clear any existing timers from previous runs
    try { if (logTimerRef.current) clearTimeout(logTimerRef.current); } catch (_) {}
  try { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); } catch (_) {}
  try { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); } catch (_) {}
    try {
      // Stage the latest selection immediately so tmp/selection-from-pipeline.json reflects current run
      try {
        const stagePayload = await Promise.all((ids || []).map(async cid => {
          const a = (articles || []).find(x => x && x.id === cid);
          const slug = slugifyTitle(a?.title || '');
          const title = String(a?.title || slug);
          const summary = String(a?.summary || '');
          return { id: null, slug, title, summary } as any;
        }));
        await fetch('/api/selection-staging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: stagePayload }) });
      } catch (e) { /* ignore staging errors */ }

      const resp = await fetch('/api/run-selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const j = await resp.json();
      if (!resp.ok) { setActionStatus(`Pipeline error: ${j.error || resp.statusText}`); setIsRunningSelection(false); return }
      const started = j.startedAt || Date.now();
      // prepare expected identifiers/counters for this run to avoid false positives
      try {
        expectedSlugsRef.current = null;
        expectedIdsRef.current = null;
        expectedCountRef.current = null;
        // Use pipeline-returned signals when available
        if (Array.isArray(j.slugs) && j.slugs.length) expectedSlugsRef.current = j.slugs.map((s: any) => String(s || ''));
        if (Array.isArray(j.ids) && j.ids.length) expectedIdsRef.current = j.ids.map((s: any) => String(s || ''));
        // If the pipeline didn't supply a count, fall back to the number of ids we requested
        if (typeof j.count === 'number') expectedCountRef.current = j.count;
        else expectedCountRef.current = Array.isArray(ids) ? ids.length : null;
        if (typeof j.token === 'string' && j.token) expectedTokenRef.current = String(j.token);
        // If no slugs were provided by the API, derive them from our selection as a fallback
        if ((!expectedSlugsRef.current || !expectedSlugsRef.current.length) && Array.isArray(ids) && ids.length) {
          try {
            const fallbackSlugs: string[] = [];
            for (const cid of ids) {
              const a = (articles || []).find(x => x && x.id === cid);
              if (a) fallbackSlugs.push(slugifyTitle(a.title || ''));
            }
            if (fallbackSlugs.length) expectedSlugsRef.current = fallbackSlugs;
          } catch (_) { /* ignore */ }
        }
      } catch (e) { expectedSlugsRef.current = null; expectedIdsRef.current = null; expectedCountRef.current = null; }
      setPipelineStartedAt(started);
      let msg = `Queued ${j.count} item(s). Waiting for pipeline to finish...`;
      if (j.invocation) msg = `${msg} (invocation: ${j.invocation})`;
      setActionStatus(msg);

      // optional: start fast parallel DB verification
      if (fastVerify) {
        const loop = async () => {
          try {
            const results = await Promise.all((ids || []).map(async (cid) => {
              const st = runProgressRef.current[cid] || 'running';
              if (st === 'done') return { selId: cid, ok: false };
              // Only verify by numeric DB id. Do not attempt slug/title lookups.
              const meta = resolvedMetaRef.current || {} as any;
              const idNum = meta[cid] && typeof meta[cid].id === 'number' ? meta[cid].id : null;
              if (!idNum) return { selId: cid, ok: false };
              try {
                const r = await fetch(`/api/articles/${encodeURIComponent(String(idNum))}`, { cache: 'no-store' });
                if (!r || !r.ok) return { selId: cid, ok: false };
                const data = await r.json().catch(() => ({}));
                const maybe = (typeof data?.id !== 'undefined') ? data.id : (data?.article?.id);
                const foundId = (typeof maybe !== 'undefined' && maybe !== null) ? Number(maybe) : null;
                if (foundId == null) return { selId: cid, ok: false };
                const excerpt = (data && (data.excerpt || data.summary || undefined)) || undefined;
                const coverImage = (data && (data.thumbnail || data.coverImage || undefined)) || undefined;
                return { selId: cid, ok: true, id: foundId, excerpt, coverImage } as any;
              } catch { return { selId: cid, ok: false }; }
            }));
            const successes = results.filter((r: any) => r && r.ok);
            if (successes.length) {
              setRunProgress(prev => {
                const next = { ...prev };
                for (const r of successes) next[r.selId] = 'done';
                return next;
              });
              for (const r of successes) {
                const current = resolvedMetaRef.current || {} as any;
                current[r.selId] = { id: (typeof r.id === 'number' ? r.id : (r.id == null ? null : Number(r.id))), excerpt: r.excerpt, coverImage: r.coverImage };
                resolvedMetaRef.current = current;
              }
            }
          } catch {}
          try { fastTimerRef.current = setTimeout(loop, 1000); } catch {}
        };
        loop();
      }

      // poll log and status
      const deadline = Date.now() + 1000 * 60 * 5; // 5 minutes
  const startLogPoll = () => {
        const lp = async () => {
          try {
            const sinceParam = started ? `&since=${started}` : '';
            const lr = await fetch(`/api/pipeline-log?lines=80${sinceParam}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            const lj = await lr.json();
            if (lj && Array.isArray(lj.lines)) setPipelineLogLines(lj.lines.filter(Boolean));
          } catch (e) { /* ignore */ }
          try { logTimerRef.current = setTimeout(lp, 2000); } catch (_) {}
        };
        lp();
      };
      startLogPoll();
      // initialize per-item progress for the UI
      try {
        const m: Record<string, 'queued'|'running'|'done'|'failed'> = {};
        for (const id of ids) m[id] = 'running';
        setRunProgress(m);
      } catch (e) { /* ignore */ }

  // Removed early JSON write. We'll only export after DB verification provides numeric IDs.

      const poll = async () => {
        try {
          const q = new URL('/api/pipeline-status', location.origin);
          q.searchParams.set('since', String(started));
          const r = await fetch(q.toString(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
          const jj = await r.json();
          // Consider pipeline finished only when API explicitly reports finished
          // or when a meaningful summary with items/count is present.
          const finishedFlag = jj && (jj.finished === true || (jj.summary && ((typeof jj.summary.count === 'number' && jj.summary.count > 0) || (Array.isArray(jj.summary.items) && jj.summary.items.length > 0))));
          if (finishedFlag) {
            // Match the summary to this run using available signals: slug, id, or count
            let matchesExpected = false;
            try {
              const expectedSlugs = expectedSlugsRef.current;
              const expectedIds = expectedIdsRef.current;
              const expectedCount = expectedCountRef.current;
              const expectedToken = expectedTokenRef.current;
              const items = (jj.summary && Array.isArray(jj.summary.items)) ? jj.summary.items : [];
              const itemSlugs = items.map((it: any) => String(it.slug || ''));
              const itemIds = items.flatMap((it: any) => {
                const candidates = [it?.id, it?.sourceId, it?.originalId, it?.selectionId, it?.articleId];
                return candidates.map((c: any) => (c === null || c === undefined) ? '' : String(c));
              }).filter(Boolean);
              const summaryToken = (jj.summary && (jj.summary.invocationToken || jj.summary.token)) ? String(jj.summary.invocationToken || jj.summary.token) : null;

              // Stronger matching rules to avoid accepting partial summaries.
              // 1) If a token was provided and matches, accept immediately.
              // 2) If an expectedCount was provided, require the summary count >= expectedCount.
              // 3) If expectedSlugs is provided, require all expected slugs to be present in the summary.
              // 4) If expectedIds is provided, require all expected ids to be present.
              // 5) If no expectations were provided, accept the summary.
              const summaryCount = (jj.summary && typeof jj.summary.count === 'number') ? jj.summary.count : Array.isArray(items) ? items.length : 0;
              if (expectedToken && summaryToken && expectedToken === summaryToken) {
                matchesExpected = true;
              } else if (expectedCount !== null) {
                if (summaryCount >= expectedCount) matchesExpected = true;
              } else if (expectedSlugs && expectedSlugs.length) {
                // require that all expected slugs are present in the returned items
                matchesExpected = expectedSlugs.every((s: string) => itemSlugs.includes(s));
              } else if (expectedIds && expectedIds.length) {
                matchesExpected = expectedIds.every((i: string) => itemIds.includes(i));
              } else {
                // no expectations provided -> accept
                matchesExpected = true;
              }
            } catch (e) { matchesExpected = false; }

            // Proceed to DB verification when either the summary matches expected signals
            // OR the pipeline explicitly reports finished (even with 0 items).
            if (!matchesExpected && jj && jj.finished === true) {
              try {
                const note = `Proceeding with DB verification via fallback (finished=true but no match).`;
                setPipelineLogLines(prev => [...prev.slice(-200), note]);
              } catch (e) { /* ignore */ }
            }

            if (matchesExpected || (jj && jj.finished === true)) {
              setPipelineSummary(jj.summary || null);
              const items = (jj.summary && Array.isArray(jj.summary.items)) ? jj.summary.items : [];
              const count = (jj.summary && typeof jj.summary.count === 'number') ? jj.summary.count : (Array.isArray(items) ? items.length : 'unknown');
              setActionStatus(`Pipeline finished: ${count} upserted. Verifying in DB...`);
              try { if (logTimerRef.current) clearTimeout(logTimerRef.current); } catch (_) {}
              try { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); } catch (_) {}
              try { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); } catch (_) {}
              // After pipeline, verify existence in DB via API before finalizing per-item status
              try {
                const summarySlugs = items.map((it: any) => String(it.slug || '')).filter(Boolean).map((s: string) => s.toLowerCase());
                const summaryIds = items.flatMap((it: any) => {
                  const candidates = [it?.id, it?.sourceId, it?.originalId, it?.selectionId, it?.articleId];
                  return candidates.map((c: any) => (c === null || c === undefined) ? '' : String(c));
                }).filter(Boolean);
                const summaryTitles = items.map((it: any) => normalizeTitle(String(it.title || '')));
                const summaryUrls = items.map((it: any) => normalizeUrl(String(it.url || '')));
                setLastSummaryKeys({ slugs: summarySlugs, titles: summaryTitles, urls: summaryUrls, ids: summaryIds });
                // Quick optimistic mark: if selection title-derived slug exists in summary, mark done pre-DB
                try {
                  const optimistic: Record<string, true> = {};
                  for (const cid of ids) {
                    const a = (articles || []).find(x => x && x.id === cid);
                    if (!a) continue;
                    const d = slugifyTitle(a.title || '');
                    if (d && summarySlugs.includes(d.toLowerCase())) optimistic[cid] = true;
                  }
                  if (Object.keys(optimistic).length) {
                    setRunProgress(prev => {
                      const next = { ...prev };
                      for (const k of Object.keys(optimistic)) next[k] = 'done';
                      return next;
                    });
                  }
                } catch {}

                // Build mapping from selection -> numeric ID only. Do NOT fallback to title/slug/url matching.
                type Candidate = { selId: string; dbKey: string | null; method: 'id' | null };
                const picks: Candidate[] = [];
                const usedIndexes = new Set<number>();
                for (const cid of ids) {
                  // Try to find a numeric id reported in the pipeline summary matching either the selection id or any of the candidate id fields
                  let foundId: string | null = null;
                  for (const it of items) {
                    const numeric = (it && (it.id ?? it.articleId ?? it.selectionId ?? it.sourceId ?? it.originalId));
                    if (typeof numeric !== 'undefined' && numeric !== null && String(numeric).match(/^[0-9]+$/)) {
                      const s = String(numeric);
                      // Prefer an exact match where the pipeline numeric id equals the selection cid string
                      if (s === String(cid)) { foundId = s; break; }
                      // Otherwise, if this candidate item hasn't been used yet, accept it for single-item runs
                      if (!usedIndexes.has(items.indexOf(it))) { foundId = s; break; }
                    }
                  }
                  if (foundId) {
                    picks.push({ selId: cid, dbKey: foundId, method: 'id' });
                  } else {
                    picks.push({ selId: cid, dbKey: null, method: null });
                  }
                }

                // Verify via API and capture numeric ids when available
                const verify = async (p: Candidate) => {
                  if (!p.method) return { ok: false, id: null as number | null };
                  try {
                    // Always try numeric ID first when available
                    if (p.method === 'id') {
                      if (!p.dbKey) return { ok: false, id: null };
                      const r1 = await fetch(`/api/articles/${encodeURIComponent(p.dbKey)}`, { cache: 'no-store' });
                      if (r1 && r1.ok) {
                        const d = await r1.json();
                        const maybe = (typeof d?.id !== 'undefined') ? d.id : (d?.article?.id);
                        const id = (typeof maybe !== 'undefined' && maybe !== null) ? Number(maybe) : null;
                        if (id != null) return { ok: true, id };
                      }
                      // If numeric lookup fails, do not fall back to slug here — that indicates it isn't present by ID yet.
                      return { ok: false, id: null };
                    }
                    // Title-based search then numeric confirmation
                    if (p.method === 'title') {
                      const a = (articles || []).find(x => x && x.id === p.selId);
                      const title = a ? String(a.title || '') : '';
                      if (!title) return { ok: false, id: null };
                      const q = encodeURIComponent(title.slice(0, 60));
                      const sr = await fetch(`/api/articles?q=${q}&pagesize=50&includeDrafts=1&useSupabase=1`, { cache: 'no-store' });
                      if (!sr || !sr.ok) return { ok: false, id: null };
                      const sj = await sr.json();
                      const items = (sj && (sj.data || sj.items || [])) || [];
                      if (!Array.isArray(items) || !items.length) return { ok: false, id: null };
                      const tnorm = normalizeTitle(title);
                      const match = items.find((it: any) => normalizeTitle(String(it?.title || '')) === tnorm) || items[0];
                      if (!match || typeof match.id === 'undefined' || match.id === null) return { ok: false, id: null };
                      const idStr = String(match.id);
                      const rr = await fetch(`/api/articles/${encodeURIComponent(idStr)}`, { cache: 'no-store' });
                      if (!rr || !rr.ok) return { ok: false, id: null };
                      const data = await rr.json();
                      const maybe = (typeof data?.id !== 'undefined') ? data.id : (data?.article?.id);
                      const idNum = (typeof maybe !== 'undefined' && maybe !== null) ? Number(maybe) : null;
                      if (idNum == null) return { ok: false, id: null };
                      return { ok: true, id: idNum };
                    }
                    return { ok: false, id: null };
                  } catch { return { ok: false, id: null }; }
                };

                const results = await Promise.all(picks.map(verify));
                const finalized: Record<string, 'queued'|'running'|'done'|'failed'> = {};
                const resolvedIds: Record<string, number | null> = {};
                picks.forEach((p, i) => {
                  finalized[p.selId] = results[i]?.ok ? 'done' : 'failed';
                  resolvedIds[p.selId] = results[i]?.id ?? null;
                });
                setRunProgress(prev => ({ ...prev, ...finalized }));
                // save meta for export
                try {
                  const cur = resolvedMetaRef.current || {};
                  for (const k of Object.keys(resolvedIds)) {
                    const v = resolvedIds[k];
                    if (!cur[k]) cur[k] = { id: v };
                    else cur[k].id = v;
                  }
                  resolvedMetaRef.current = cur;
                } catch {}
                const okCount = results.filter(r => r?.ok).length;
                setActionStatus(`Verified in DB: ${okCount}/${ids.length} confirmed`);
              } catch (e) { /* ignore */ }
              expectedSlugsRef.current = null;
              expectedIdsRef.current = null;
              expectedCountRef.current = null;
              expectedTokenRef.current = null;
              // Build export payload: use summary fields when present; fallback to original article data.
              try {
                const capturedResolvedIds = (typeof (globalThis as any) !== 'undefined') ? ({} as Record<string, number | null>) : ({} as Record<string, number | null>);
                // copy resolvedIds from earlier scope into a local const via JSON trick to avoid mutation surprises
                // @ts-ignore - resolvedIds is in scope above
                Object.assign(capturedResolvedIds, resolvedIds);
                const exportItems = (ids || []).map(cid => {
                  const found = (articles || []).find(a => String(a.id) === String(cid));
                  // Find matching summary item again to extract fields (slug, excerpt, cover)
                  const sidx = (() => {
                    if (!Array.isArray(items)) return -1;
                    // prefer id-based match
                    if ((lastSummaryKeys as any)?.ids?.length) {
                      const ix = items.findIndex((it: any) => {
                        const candidates = [it?.id, it?.sourceId, it?.originalId, it?.selectionId, it?.articleId].filter((x: any) => x !== null && x !== undefined).map(String);
                        return candidates.includes(String(cid));
                      });
                      if (ix !== -1) return ix;
                    }
                    // try slug/title/url based match
                    const derived = slugifyTitle(found?.title || '');
                    if (derived) {
                      const ix2 = items.findIndex((it: any) => String(it?.slug || '').toLowerCase() === derived.toLowerCase());
                      if (ix2 !== -1) return ix2;
                    }
                    const tkey = normalizeTitle(found?.title || '');
                    if (tkey) {
                      const ix3 = items.findIndex((it: any) => normalizeTitle(String(it?.title || '')) === tkey);
                      if (ix3 !== -1) return ix3;
                    }
                    const ukey = normalizeUrl(found?.url || '');
                    if (ukey) {
                      const ix4 = items.findIndex((it: any) => normalizeUrl(String(it?.url || '')) === ukey);
                      if (ix4 !== -1) return ix4;
                    }
                    return -1;
                  })();
                  const sit = (Array.isArray(items) && sidx !== -1) ? items[sidx] : null;
                  const slug = String(sit?.slug || slugifyTitle(found?.title || ''));
                  const title = String(sit?.title || found?.title || slug);
                  const summary = String(sit?.excerpt || sit?.summary || found?.summary || '');
                  const coverImage = String((sit?.thumbnail || sit?.coverImage || '') || '');
                  // If summary empty but we have an excerpt hint, prefer that; already handled above
                  const ridVal = (typeof capturedResolvedIds[cid] !== 'undefined' && capturedResolvedIds[cid] !== null) ? Number(capturedResolvedIds[cid]) : null;
                  return {
                    id: (sit?.id ?? sit?.articleId ?? ridVal ?? null) ?? null,
                    slug,
                    title,
                    summary,
                    coverImage: coverImage || undefined
                  };
                });
                // If id is missing, try to fetch by slug to populate numeric DB id
        const exportItemsWithId = await Promise.all(exportItems.map(async (it) => {
      if ((it as any).id == null && it.slug) {
                    try {
                      const rr = await fetch(`/api/articles/${encodeURIComponent(it.slug)}`, { cache: 'no-store' });
                      if (rr.ok) {
                        const data = await rr.json();
                        const aid = (data && (typeof data.id !== 'undefined' ? data.id : (data.article && data.article.id))) as number | undefined;
        if (typeof aid !== 'undefined') return { ...it, id: (aid == null ? null : Number(aid)) } as any;
                      }
                    } catch {}
                  }
      return { ...it, id: ((it as any).id == null ? null : Number((it as any).id)) } as any;
                }));
                // POST to API to write the file
                try {
                  await fetch('/api/selection-export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selected: exportItemsWithId })
                  });
                } catch {}
              } catch {}
              setIsRunningSelection(false);
              return;
            } else {
              // ignore this summary because it doesn't appear to correspond to our run
              try {
                const note = `Ignored pipeline summary (no match) mtime=${jj.mtime || 'unknown'}; expectedSlugs=${JSON.stringify(expectedSlugsRef.current)} expectedIds=${JSON.stringify(expectedIdsRef.current)} expectedCount=${String(expectedCountRef.current)}`;
                // keep debug note in pipelineLogLines array (not shown in UI) for diagnostics
                setPipelineLogLines(prev => [...prev.slice(-200), note]);
              } catch (e) { /* ignore */ }
            }
          }
        } catch (e) { /* ignore */ }
        if (Date.now() < deadline) {
          try { pollTimerRef.current = setTimeout(poll, 2000); } catch (_) {}
        } else {
          try { if (logTimerRef.current) clearTimeout(logTimerRef.current); } catch (_) {}
          try { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); } catch (_) {}
          try { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); } catch (_) {}
          setActionStatus('Pipeline is taking longer than expected. Check logs or tmp/ for pipeline-summary files.');
          setIsRunningSelection(false);
        }
      };
      setTimeout(poll, 1200);
    } catch (e) {
      setActionStatus(`Network error: ${String(e)}`);
      setIsRunningSelection(false);
    }
  }
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  // Ensure selectionPreview is populated when confirmIds or selectionItems change
  useEffect(() => {
    if (!confirmIds || !confirmIds.length) return;
    if (!selectionItems || !selectionItems.length) return;
    try {
      for (const cid of confirmIds) {
        // Skip if already present
        if (selectionPreview && Object.prototype.hasOwnProperty.call(selectionPreview, cid) && selectionPreview[cid]) continue;
        const a = (articles || []).find(x => x && x.id === cid);
        if (!a) continue;
        const norm = normalizeTitle(a.title || '');
        let matched: { slug?: string; title?: string } | null = null;
        for (const it of selectionItems) {
          try {
            const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
            const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
            const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
            if (itId && (String(a.id) === itId || String((a as any).numId) === itId)) { matched = { slug: itSlug, title: itTitle }; break; }
            if (itSlug && itSlug === slugifyTitle(a.title || '')) { matched = { slug: itSlug, title: itTitle }; break; }
            if (itTitle && norm && normalizeTitle(itTitle) === norm) { matched = { slug: itSlug, title: itTitle }; break; }
          } catch (_) {}
        }
        if (matched) setSelectionPreview(prev => ({ ...prev, [cid]: matched }));
      }
    } catch (_) {}
  }, [confirmIds, selectionItems]);
  const [isRunningSelection, setIsRunningSelection] = useState(false);

  // derive filtered list for image panel based on mode/query (after confirmIds declared)
  const filteredImgIds = useMemo<string[]>(() => {
    const ids = Array.isArray(confirmIds) ? [...confirmIds] : [];
    const q = (imgFilterQuery || '').trim().toLowerCase();
    const byMode = ids.filter((cid: string) => {
      const has = Boolean(genImg[cid]);
      const status = runProgress[cid] || (isRunningSelection ? 'running' : 'queued');
      if (imgFilterMode === 'noimg') return !has;
      if (imgFilterMode === 'hasimg') return has;
      if (imgFilterMode === 'done') return status === 'done';
      if (imgFilterMode === 'failed') return status === 'failed';
      return true; // all
    });
    if (!q) return byMode;
    return byMode.filter((cid: string) => {
      const a = (articles || []).find(x => x && x.id === cid);
      const hay = ((a?.title || '') + ' ' + (a?.summary || '')).toLowerCase();
      return hay.includes(q);
    });
  }, [confirmIds, imgFilterMode, imgFilterQuery, genImg, runProgress, isRunningSelection, articles]);

  // Do not persist selectedIds across reloads — always start empty
  // (Previously restored from localStorage; removed per requirement.)

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      try { if (logTimerRef.current) clearTimeout(logTimerRef.current); } catch (_) {}
      try { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); } catch (_) {}
      try { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); } catch (_) {}
    };
  }, []);

  // Auto-export when all selected items are done (fast-verify path included)
  useEffect(() => {
    const go = async () => {
      if (!confirmIds || confirmIds.length === 0) return;
      if (exportedRef.current) return;
      const allDone = confirmIds.every(cid => (runProgress[cid] || 'running') === 'done');
      // If everything is verified done via fast path, end the run early to avoid the UI being stuck in "Running" state.
      if (allDone && isRunningSelection) {
        try { if (logTimerRef.current) clearTimeout(logTimerRef.current); } catch (_) {}
        try { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); } catch (_) {}
        try { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); } catch (_) {}
        setActionStatus(`Verified in DB: ${confirmIds.length}/${confirmIds.length} confirmed (early finish)`);
        setIsRunningSelection(false);
      }
      if (!allDone) return;
      try {
        const selected = await Promise.all(confirmIds.map(async cid => {
          const a = (articles || []).find(x => x && x.id === cid);
          const slug = slugifyTitle(a?.title || '');
          const title = String(a?.title || slug);
          const summary = String(a?.summary || '');
          const meta = resolvedMetaRef.current[cid] || {};
          let idVal: number | undefined = (typeof meta.id === 'number') ? meta.id : undefined;
          if (typeof idVal === 'undefined' && slug) {
            try {
              const rr = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { cache: 'no-store' });
              if (rr.ok) {
                const data = await rr.json();
                const aid = (typeof data?.id !== 'undefined') ? data.id : (data?.article?.id);
                if (typeof aid !== 'undefined' && aid !== null) idVal = Number(aid);
              }
            } catch {}
          }
          const coverImage = meta.coverImage;
          return { id: (typeof idVal === 'number' ? idVal : null), slug, title, summary, coverImage } as any;
        }));
        const r = await fetch('/api/selection-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected })
        });
        const jj = await r.json().catch(() => ({} as any));
        if (r.ok) {
          exportedRef.current = true;
          setActionStatus('Selection report exported with DB IDs');
        } else {
          setActionStatus(`Export failed: ${jj && jj.error ? jj.error : r.statusText}`);
        }
      } catch {
        // ignore export errors
      }
    };
    go();
  }, [runProgress, confirmIds, articles]);

  // live-resolve selectionInput into article previews (matches against full articles list)
  useEffect(() => {
    const raw = String(selectionInput || '').trim();
    if (!raw) { setResolvedPreview([]); return }
    const tokens = raw.split(/[\s,]+/).filter(Boolean);
    const matched: Article[] = [];
    for (const tok of tokens) {
      if (/^\d+$/.test(tok)) {
        const num = Number(tok);
        const found = (articles || []).find(a => Number(a.numId) === num);
        if (found) matched.push(found);
      } else {
        const found = (articles || []).find(a => a.id === tok);
        if (found) matched.push(found);
      }
    }
    setResolvedPreview(matched);
  }, [selectionInput, articles]);

  // No localStorage write for selectedIds — selection is session-only

  const detectedSources = useMemo(() => {
    const s = new Set<string>();
    (articles || []).forEach(a => { if (a && (a as any).source) s.add(String((a as any).source).toLowerCase()); });
    return Array.from(s).sort();
  }, [articles]);

  // Ensure these common sources are available as filters even if not present in the current feed.
  // Assumption: common source keys in the JSON are lower-case like 'coindesk', 'cointelegraph', 'google-news', 'decrypt', 'theblock'
  const preferredSources = ['google-news', 'coindesk', 'cointelegraph', 'decrypt', 'theblock'];

  const sources = useMemo(() => {
    const s = new Set(detectedSources);
    for (const p of preferredSources) s.add(p);
    return Array.from(s).sort();
  }, [detectedSources]);

  // prepare deduped frequent keywords (remove any that appear in topKeywords)
  const dedupedFrequent = useMemo(() => {
    const topSet = new Set((topKeywords || []).map(k => String((k as any).key)));
    if (!mostFrequent) return [] as { key: string; label: string; count: number }[];
    // prefer unigrams in the frequent row for clarity
    return mostFrequent.filter(m => !topSet.has((m as any).key) && (m as any).key && (m as any).key.split(' ').length === 1);
  }, [mostFrequent, topKeywords]);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    const kf = (keywordFilter || '').toLowerCase();
    let out = (articles || []).filter(a => {
      if (!a) return false;
      if (source !== 'all' && a.source !== source) return false;
      if (!q && !kf) return true;
      // text search by raw query
      if (q) {
        const hay = (String(a.title || '') + ' ' + String(a.summary || '')).toLowerCase();
        if (hay.includes(q)) return true;
      }
      // keyword filter uses normalized stems attached to article
      if (kf) {
        // special Binance keyword: match any source that starts with 'binance-'
        if (kf === '__binance__') {
          const s = String(a.source || '').toLowerCase();
          if (s.startsWith('binance-')) return true;
        }
        const stems = (a.stems || []).map(s => String(s || '').toLowerCase());
        if (stems.includes(kf)) return true;
      }
      return false;
    });
    out.sort((a,b) => {
      const ta = new Date(a.publishedAt || 0).getTime();
      const tb = new Date(b.publishedAt || 0).getTime();
      return sort === 'newest' ? tb - ta : ta - tb;
    });
    return out;
  }, [articles, query, source, sort, keywordFilter]);

  // Reset to first page when filters change or when the filtered list shrinks
  useEffect(() => {
    setPage(0);
  }, [query, source, sort, keywordFilter, articles]);

  // Clamp page when filtered length changes
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [filtered.length]);

  // when pipeline summary becomes available, try to fetch selection-status once
  useEffect(() => {
    if (!pipelineSummary) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/selection-status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j && j.ready && Array.isArray(j.items)) {
          if (cancelled) return;
          setSelectionItems(j.items);
          const map: Record<string, any> = {};
          for (const it of j.items) {
            try {
              const keySlug = (it.slug || it.fields?.slug || it.data?.slug || '') || '';
              const keyTitle = (it.title || it.fields?.title || it.data?.title || '') || '';
              if (keySlug) map[String(keySlug)] = it;
              if (keyTitle) map[String(normalizeTitle(keyTitle))] = it;
            } catch (_) {}
          }
          selectionMapRef.current = map;
        }
      } catch (_) {}
    })();
    return () => { cancelled = true };
  }, [pipelineSummary]);

  // Also fetch selection-status on mount so tmp/selected.json is available immediately
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/selection-status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        const j = await r.json().catch(() => ({} as any));
        if (r.ok && j && j.ready && Array.isArray(j.items) && !cancelled) {
          setSelectionItems(j.items);
          const map: Record<string, any> = {};
          for (const it of j.items) {
            try {
              const keySlug = it.slug || it.fields?.slug || it.data?.slug || '';
              const keyTitle = it.title || it.fields?.title || it.data?.title || '';
              if (keySlug) map[String(keySlug)] = it;
              if (keyTitle) map[String(normalizeTitle(keyTitle))] = it;
            } catch (_) {}
          }
          selectionMapRef.current = map;
          // also populate selectionPreview for any already-confirmed ids on screen
          try {
            if (confirmIds && confirmIds.length) {
              for (const cid of confirmIds) {
                const a = (articles || []).find(x => x && x.id === cid);
                if (!a) continue;
                // try to match
                const norm = normalizeTitle(a.title || '');
                for (const it of j.items) {
                  try {
                    const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
                    const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
                    const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
                    if (itSlug && itSlug === slugifyTitle(a.title || '')) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); break; }
                    if (itId && (String(a.id) === itId || String((a as any).numId) === itId)) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); break; }
                    if (itTitle && norm && normalizeTitle(itTitle) === norm) { setSelectionPreview(prev => ({ ...prev, [cid]: { slug: itSlug, title: itTitle } })); break; }
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    })();
    return () => { cancelled = true };
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1>Aggregated Headlines</h1>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
          <select className="select" defaultValue={String(hoursUsed || 12)} onChange={e=>{ if (typeof window !== 'undefined'){ (window as any).__hoursSel = e.target.value; const v = e.target.value; try { window.location.href = `/aggregator?hours=${encodeURIComponent(v)}`; } catch { window.location.reload(); } } }} style={{ width:120 }}>
            <option value="6">Last 6 hours</option>
            <option value="12">Last 12 hours</option>
            <option value="24">Last 24 hours</option>
          </select>
          <button className="pgBtn" style={{ background:'#0ea5e9', color:'#fff', borderColor:'#0284c7' }} onClick={async ()=>{
            try {
              const hours = (typeof window !== 'undefined' && (window as any).__hoursSel) || '6';
              const r = await fetch('/api/fetch-latest', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ hours }) });
              const j = await r.json().catch(()=>({}));
              setActionStatus(r.ok ? 'Fetching latest… done' : `Fetch failed: ${j.error || r.statusText}`);
              // Optionally reload the page after fetch completes
              if (r.ok) {
                setTimeout(()=>{ try { window.location.href = `/aggregator?hours=${encodeURIComponent(hours)}`; } catch { window.location.reload(); } }, 500);
              }
            } catch(e:any){ setActionStatus('Fetch error: '+(e?.message||String(e))); }
          }}>Fetch Latest</button>
        </div>
        <div className="controls">
          <input
            aria-label="filter"
            className="input"
            type="text"
            placeholder="Search title or summary..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          <select className="select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {sources.map(s => {
              const labelMap: Record<string,string> = {
                'google-news': 'Google News',
                'coindesk': 'Coindesk',
                'cointelegraph': 'Cointelegraph',
                'decrypt': 'Decrypt',
                'theblock': 'The Block'
              };
              const label = labelMap[s] || s;
              return <option key={s} value={s}>{label}</option>;
            })}
          </select>

          <select className="select" value={sort} onChange={e => setSort(e.target.value as any)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <div className="summaryLine">Showing {filtered.length} of {articles.length} articles</div>
        <div style={{ marginTop: 6, color: '#374151', fontSize: 13 }}>
          Selected: {selectedIds.length} {selectedIds.length > 0 ? ` — ${selectedIds.slice(0,6).map(id => {
            const found = (articles || []).find(a => a && a.id === id);
            return found && found.numId ? `#${found.numId}` : id;
          }).join(', ')}${selectedIds.length > 6 ? '...' : ''}` : ''}
        </div>
  {/* debug panels removed */}
        <div className="keywords">
          {/** Special Binance chip: filters any source starting with "binance-" */}
          {articles && articles.some(a=>String(a.source||'').toLowerCase().startsWith('binance-')) ? (
            (() => {
              const cnt = articles.filter(a=>String(a.source||'').toLowerCase().startsWith('binance-')).length;
              return (
                <button key="__binance__" className={"chip" + (keywordFilter==='__binance__'? ' active':'')} onClick={() => setKeywordFilter(keywordFilter==='__binance__' ? '' : '__binance__')}>
                  Binance <span className="count">{cnt}</span>
                </button>
              );
            })()
          ) : null}

          {topKeywords && topKeywords.length > 0 ? (
            topKeywords.map(k => {
              const item = k as { key: string; label: string; count: number };
              return (
                <button key={item.key} className={"chip" + (keywordFilter===item.key? ' active':'')} onClick={() => setKeywordFilter(keywordFilter===item.key? '': item.key)}>
                  {item.label} <span className="count">{item.count}</span>
                </button>
              );
            })
          ) : null}
        </div>
        {/** Most frequent (by document frequency) - shows high-coverage tokens like 'solana' */}
        <div style={{ marginTop: 10, color: '#374151', fontSize: 13 }}>Frequent</div>
        <div className="keywords">
          {dedupedFrequent && dedupedFrequent.length > 0 ? (
            dedupedFrequent.map(k => {
              const item = k as { key: string; label: string; count: number };
              return (
                <button key={item.key} className={"chip" + (keywordFilter===item.key? ' active':'')} onClick={() => setKeywordFilter(keywordFilter===item.key? '': item.key)}>
                  {item.label} <span className="count">{item.count}</span>
                </button>
              );
            })
          ) : null}
        </div>
      </header>

      <main>
        {filtered.length === 0 ? (
          <div className="empty">No articles found.</div>
        ) : (
          <>
            <div className="grid">
              {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(article => (
                <article key={article.id} className={"card" + (selectedIds.includes(article.id) ? ' selected' : '')}>
                  <a className="titleLink" href={article.url} target="_blank" rel="noopener noreferrer">
                    <h2 className="title">
                      {keywordFilter ? (
                        // highlight first occurrence
                        (() => {
                          const t = article.title || '';
                          const idx = t.toLowerCase().indexOf(keywordFilter.toLowerCase());
                          if (idx === -1) return t;
                          return (
                            <span>
                              {t.slice(0, idx)}<mark>{t.slice(idx, idx + keywordFilter.length)}</mark>{t.slice(idx + keywordFilter.length)}
                            </span>
                          );
                        })()
                      ) : article.title}
                    </h2>
                  </a>
                  <div className="meta">{new Date(article.publishedAt || Date.now()).toLocaleString()} · <span className="badge">{article.source}</span> <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>#{article.numId || '?'}</span></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <button className="selectBtn" onClick={() => {
                      setSelectedIds(prev => {
                        const exists = prev.includes(article.id);
                        if (exists) return prev.filter(x => x !== article.id);
                        return [...prev, article.id];
                      });
                    }}>
                      {selectedIds.includes(article.id) ? 'Selected' : 'Select'}
                    </button>
                    <div className="idLabel">ID: {article.id}</div>
                  </div>
                  <div className="excerpt">{article.summary}</div>
                </article>
              ))}
            </div>

            {/* selection input: allow comma-separated indexes or ids, e.g. "2,5,21" or paste ids */}
            <div className="selectionPanel">
              <div className="previewRow">
                <input value={selectionInput} onChange={e => setSelectionInput(e.target.value)} className="input" style={{ width: 360 }} placeholder="Enter indexes or ids, e.g. 2,5,21 or paste ids" />
                <div className="previewLabel">Preview:</div>
                <div className="previewCount">{resolvedPreview.length ? `${resolvedPreview.length} matched` : 'no match'}</div>
              </div>
              {/* Fast verify is enabled by default; no toggle shown */}
              {resolvedPreview && resolvedPreview.length ? (
                <div className={"previewChips" + (resolvedPreview.length >= 3 ? ' compact' : '')}>
                  {resolvedPreview.map(p => (
                    <div key={p.id} className={"previewChip" + (resolvedPreview.length >= 3 ? ' compact' : '')}>{p.numId ? `#${p.numId}` : ''} {p.title}</div>
                  ))}
                </div>
              ) : null}
                  <button className="pgBtn" onClick={async () => {
                // Build ID list then open a confirmation modal instead of immediately running
                const raw = String(selectionInput || '').trim();
                let tokens: string[] = [];
                if (raw) tokens = raw.split(/[\s,]+/).filter(Boolean);
                const newIds: string[] = [];
                if (tokens.length > 0) {
                  for (const tok of tokens) {
                    if (/^\d+$/.test(tok)) {
                      const num = Number(tok);
                      const foundByNum = (articles || []).find(f => Number(f.numId) === num);
                      if (foundByNum) newIds.push(foundByNum.id);
                    } else {
                      const found = (articles || []).find(f => f.id === tok);
                      if (found) newIds.push(found.id);
                    }
                  }
                }
                // Always include clicked selections as well (union)
                if (selectedIds && selectedIds.length) newIds.push(...selectedIds);
                
                if (newIds.length === 0) {
                  setActionStatus('No matching ids found to run. Select article cards or enter indexes/ids.');
                  return;
                }
                // show confirmation modal with the resolved ids
                setConfirmIds(Array.from(new Set(newIds)));
                setShowConfirm(true);
              }} disabled={isRunningSelection}>{isRunningSelection ? 'Running...' : 'Process'}</button>
              <button className="pgBtn" onClick={() => { setSelectionInput(''); setSelectedIds([]); }}>Clear</button>
            </div>

            {actionStatus ? <div style={{ textAlign: 'center', marginTop: 8, color: '#065f46' }}>{actionStatus}</div> : null}

            {/* Compact pipeline status card */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #111111ff' }}>
                {isRunningSelection ? <div className="spinner" aria-hidden style={{ width: 16, height: 16 }} /> : null}
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {isRunningSelection ? 'Running' : (pipelineSummary ? 'Completed' : (actionStatus ? 'Status' : 'Idle'))}
                </div>
                <div style={{ color: '#334155', fontSize: 13 }}>
                  {actionStatus || (pipelineSummary ? `${pipelineSummary.count} items` : 'No pipeline activity')}
                </div>
                {/* compact status controls — live log removed in favor of per-item progress UI */}
              </div>
            </div>

            {/* Confirmation modal for running pipeline on selected ids */}
            {showConfirm ? (
              <div className="modalBackdrop">
                <div className="modal">
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Confirm pipeline run</div>
                  <div style={{ marginBottom: 10 }}>You are about to queue {confirmIds.length} article(s) for processing by the pipeline. This will write a selection file and spawn the pipeline to upsert via Supabase.</div>
                  <div style={{ marginBottom: 10 }}>
                    <strong>Selected articles:</strong>
                    <div className="confirmList">
                      {confirmIds.map((cid, idx) => {
                        const found = (articles || []).find(a => String(a.id) === String(cid) || String(a.url) === String(cid));
                        const title = found ? (found.title || found.id) : String(cid);
                        const numLabel = found && found.numId ? `#${found.numId} ` : '';
                        return (
                          <div key={String(cid) + '-' + idx} className="confirmItem" title={title}>
                            <div className="confirmNum">{numLabel}</div>
                            <div className="confirmTitle">{title}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button className="pgBtn" onClick={() => { setShowConfirm(false); setConfirmIds([]); }}>Cancel</button>
                    <button className="pgBtn" onClick={async () => {
                      setShowConfirm(false);
                      // run selection
                      await runSelection(confirmIds);
                    }} disabled={isRunningSelection}>{isRunningSelection ? 'Running...' : 'Confirm'}</button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Run progress UI and Image generation panel side-by-side */}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start', gap: 12, alignItems: 'flex-start' }}>
              {/* Left: Run progress */}
              <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1, minWidth: 520 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#000' }}>Run progress</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {confirmIds && confirmIds.length ? confirmIds.map(cid => {
                    const a = (articles || []).find(x => x && x.id === cid);
                    const t = a ? (a.title || a.id) : cid;
                    // Determine whether selection-derived data should be used: require the pipeline to be finished
                    const isSelectionReady = Boolean(pipelineSummary && pipelineSummary.count != null && !isRunningSelection) || (selectionItems && selectionItems.length > 0);
                    const sel = isSelectionReady && (selectionItems && selectionItems.length) ? (selectionMapRef.current[slugifyTitle((a && a.title) || '')] || selectionMapRef.current[normalizeTitle((a && a.title) || '')]) : null;
                    // Prefer selectionPreview (preflight) only when selection is ready, else use original title
                    let displayedTitle: string | undefined = undefined;
                    if (isSelectionReady && selectionPreview && selectionPreview[cid] && selectionPreview[cid].title) {
                      displayedTitle = selectionPreview[cid].title;
                    } else if (selectionItems && Array.isArray(selectionItems) && selectionItems.length) {
                      try {
                        if (isSelectionReady) {
                          const norm = normalizeTitle((a && a.title) || '');
                          for (const it of selectionItems) {
                            try {
                              const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
                              const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
                              const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
                              if (itSlug && itSlug === slugifyTitle((a && a.title) || '')) { displayedTitle = itTitle; break; }
                              if (itId && a && (String(a.id) === itId || String((a as any).numId) === itId)) { displayedTitle = itTitle; break; }
                              if (itTitle && norm && normalizeTitle(itTitle) === norm) { displayedTitle = itTitle; break; }
                            } catch (_) {}
                          }
                        }
                      } catch (_) {}
                    }
                    if (!displayedTitle) displayedTitle = (sel ? (sel.title || sel.fields?.title || sel.data?.title || t) : t);
                    const status = runProgress[cid] || (isRunningSelection ? 'running' : 'queued');
                    const isFailed = status === 'failed';
                    const isDone = status === 'done';
                    const numLabel = a && (a as any).numId ? `#${(a as any).numId} ` : '';
                     return (
                       <div
                         key={cid}
                         style={{
                           background: isDone ? '#ecfdf5' : '#fff',
                           padding: 8,
                           borderRadius: 8,
                           border: isDone ? '1px solid #a7f3d0' : '1px solid #e6eef8'
                         }}
                       >
                         <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                           <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             {status === 'done' ? (
                               <span style={{ color: '#10b981', fontSize: 18 }}>✓</span>
                             ) : isFailed ? (
                               <span style={{ color: '#ef4444' }}>✕</span>
                             ) : (
                               <div className="spinner" aria-hidden />
                             )}
                           </div>
                           <div style={{ flex: 1, color: '#000', overflow: 'hidden',  display:'flex', alignItems:'center', gap:8 }}>
                             <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{numLabel}{displayedTitle}</span>
                             {genImg[cid] ? (
                               <a href={genImg[cid]} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1d4ed8' }}></a>
                             ) : null}
                           </div>
                           <div style={{ fontSize: 12, color: '#0d0d0eff' }}>{isFailed ? 'not found' : status}</div>
                           {isFailed ? (
                             <button className="pgBtn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setDebugOpen(prev => ({ ...prev, [cid]: !prev[cid] }))}>
                               {debugOpen[cid] ? 'hide' : 'why?'}
                             </button>
                           ) : null}
                         </div>
                         {isFailed && debugOpen[cid] ? (
                           <div style={{ marginTop: 8, fontSize: 12, color: '#334155' }}>
                             <div><strong>Match keys used:</strong></div>
                             <div style={{ marginTop: 4 }}>Derived slug: <code>{slugifyTitle(displayedTitle || '')}</code></div>
                             <div>Normalized title: <code>{normalizeTitle(displayedTitle || '')}</code></div>
                             <div>URL key: <code>{normalizeUrl((a as any)?.url || '')}</code></div>
                             <div style={{ marginTop: 6 }}><strong>Summary keys:</strong></div>
                             <div>Slugs: <code>{(lastSummaryKeys?.slugs || []).slice(0,6).join(', ') || '(none)'}</code>{(lastSummaryKeys?.slugs || []).length > 6 ? ' …' : ''}</div>
                             <div>Titles: <code>{(lastSummaryKeys?.titles || []).slice(0,3).join(' | ') || '(none)'}</code>{(lastSummaryKeys?.titles || []).length > 3 ? ' …' : ''}</div>
                             <div>IDs: <code>{(lastSummaryKeys as any)?.ids?.slice?.(0,6)?.join?.(', ') || '(none)'}</code>{((lastSummaryKeys as any)?.ids?.length || 0) > 6 ? ' …' : ''}</div>
                             <div>URLs: <code>{(lastSummaryKeys?.urls || []).slice(0,3).join(' | ') || '(none)'}</code>{(lastSummaryKeys?.urls || []).length > 3 ? ' …' : ''}</div>
                             <div style={{ marginTop: 6, color: '#7c3aed' }}>Tip: Ensure the pipeline summary includes one of: matching derived slug, normalized title, or URL.</div>
                           </div>
                         ) : null}
                       </div>
                     )
                   }) : null}
                </div>
              </div>
              {/* Right: Image generation panel removed and will be rendered below Pipeline results for full-width layout */}
            </div>

            {/* Pipeline summary details (if available) */}
            {pipelineSummary && pipelineSummary.items && pipelineSummary.items.length ? (
              <div style={{ marginTop: 12, borderTop: '1px dashed #e5e7eb', paddingTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Pipeline results</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  {pipelineSummary.items.map((it: any, idx: number) => (
                    <div key={it.slug || idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #f3f4f6' }}>
                      <div style={{ width: 84, height: 56, background: '#f8fafc', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {it.thumbnail ? <img src={it.thumbnail} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 11, color: '#6b7280' }}>No image</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>
                          {it.slug ? (
                            <a href={`/articles/${encodeURIComponent(it.slug)}`} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none' }}>
                              {it.slug}
                            </a>
                          ) : (
                            '(no slug)'
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>{it.excerpt || ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <a target="_blank" rel="noreferrer" href={`/tmp/upserted-${it.slug}.html`} className="pgBtn">View debug</a>
                        <a target="_blank" rel="noreferrer" href={`/articles/${encodeURIComponent(it.slug)}`} className="pgBtn">Open article</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Image generation panel (moved below pipeline results for full-width) */}
            <div style={{ background:'#fff', padding:12, borderRadius:8, border:'1px solid #e5e7eb', width: '100%', display:'flex', flexDirection:'column', marginTop: 12, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color:'#000' }}>Image generation</div>
              {/* controls (compact two-column layout) */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6, marginBottom:8 }}>
                <label style={{ fontSize:12, color:'#374151' }}>Engine
                  <select className="select" value={imgEngine} onChange={e=>setImgEngine(e.target.value as any)} style={{ width:'100%', marginTop:4 }}>
                    <option value="auto">Auto</option>
                    <option value="responses">Responses (text→image)</option>
                    <option value="images">Images (gpt-image-1)</option>
                  </select>
                </label>
                <label style={{ fontSize:12, color:'#374151' }}>Model
                  <select className="select" value={imgModel} onChange={e=>setImgModel(e.target.value)} style={{ width:'100%', marginTop:4 }}>
                    <option value="auto">Auto</option>
                    <option value="gpt-5-chat-latest">gpt-5-chat-latest</option>
                    <option value="gpt-image-1">gpt-image-1</option>
                    <option value="gemini-image-1">Gemini Image (gemini-image-1)</option>
                  </select>
                </label>
                <label style={{ fontSize:12, color:'#374151' }}>Size
                  <select className="select" value={imgSize} onChange={e=>setImgSize(e.target.value)} style={{ width:'100%', marginTop:4 }}>
                    <option value="1024x1024">1024x1024</option>
                    <option value="1792x1024">1792x1024</option>
                    <option value="1024x1792">1024x1792</option>
                  </select>
                </label>
                <label style={{ fontSize:12, color:'#374151' }}>Style
                  <select className="select" value={imgStyle} onChange={e=>setImgStyle(e.target.value)} style={{ width:'100%', marginTop:4 }}>
                    <option value="photo">Photo</option>
                    <option value="3d">3D</option>
                    <option value="random">Random</option>
                    <option value="custom">Custom…</option>
                  </select>
                </label>
                {imgStyle === 'custom' ? (
                  <input className="input" value={imgStyleCustom} onChange={e=>setImgStyleCustom(e.target.value)} placeholder="Custom style text" />
                ) : null}
              </div>
              {/* image panel filtering & selection */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                <select className="select" value={imgFilterMode} onChange={e=>setImgFilterMode(e.target.value as any)}>
                  <option value="all">All selected</option>
                  <option value="noimg">Only without image</option>
                  <option value="hasimg">Only with image</option>
                  <option value="done">Only pipeline done</option>
                  <option value="failed">Only failed</option>
                </select>
                <input className="input" placeholder="Filter by text…" value={imgFilterQuery} onChange={e=>setImgFilterQuery(e.target.value)} />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                <button className="pgBtn" onClick={() => {
                  const next = { ...imgSel };
                  filteredImgIds.forEach(id => { next[id] = true; });
                  setImgSel(next);
                }}>Select visible</button>
                <button className="pgBtn" onClick={() => setImgSel({})}>Clear selection</button>
              </div>
              {/* batch controls */}
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                <button className="pgBtn" onClick={generateAllForSelection} disabled={batchGenActive || !(confirmIds && confirmIds.length)}>
                  {batchGenActive ? 'Generating…' : 'Generate for all'}
                </button>
                <button className="pgBtn" onClick={() => { cancelBatchRef.current = true; }} disabled={!batchGenActive}>Stop</button>
                {batchGenActive ? (
                  <div style={{ fontSize:12, color:'#374151' }}>{batchGenProgress}/{(filteredImgIds && filteredImgIds.length) ? filteredImgIds.length : (confirmIds ? confirmIds.length : 0)}</div>
                ) : null}
              </div>
              {batchGenActive ? <div className="indeterminate" style={{ marginBottom:8 }} /> : null}
              <div style={{ display:'grid', gap:12, overflow:'auto', flex: 1 }}>
                {confirmIds && confirmIds.length ? confirmIds.map(cid => {
                  const a = (articles || []).find(x => x && x.id === cid);
                  const t = a ? (a.title || a.id) : cid;
                  // Determine whether selection-derived data should be used: require the pipeline to be finished
                  const isSelectionReady = Boolean(pipelineSummary && pipelineSummary.count != null && !isRunningSelection) || (selectionItems && selectionItems.length > 0);
                  const sel = isSelectionReady && (selectionItems && selectionItems.length) ? (selectionMapRef.current[slugifyTitle((a && a.title) || '')] || selectionMapRef.current[normalizeTitle((a && a.title) || '')]) : null;
                  // Prefer selectionPreview (preflight) only when selection is ready, else try to locate a matching item inside selectionItems
                  let displayedTitle: string | undefined = undefined;
                  if (isSelectionReady && selectionPreview && selectionPreview[cid] && selectionPreview[cid].title) {
                    displayedTitle = selectionPreview[cid].title;
                  } else if (selectionItems && Array.isArray(selectionItems) && selectionItems.length) {
                    // try to find by slug / id / numId / normalized title
                    try {
                      if (isSelectionReady) {
                        const norm = normalizeTitle((a && a.title) || '');
                        for (const it of selectionItems) {
                          try {
                            const itSlug = it.slug || it.fields?.slug || it.data?.slug || '';
                            const itTitle = it.title || it.fields?.title || it.data?.title || it.excerpt || '';
                            const itId = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : '';
                            if (itSlug && itSlug === slugifyTitle((a && a.title) || '')) { displayedTitle = itTitle; break; }
                            if (itId && a && (String(a.id) === itId || String((a as any).numId) === itId)) { displayedTitle = itTitle; break; }
                            if (itTitle && norm && normalizeTitle(itTitle) === norm) { displayedTitle = itTitle; break; }
                          } catch (_) {}
                        }
                      }
                    } catch (_) {}
                  }
                  if (!displayedTitle) displayedTitle = (sel ? (sel.title || sel.fields?.title || sel.data?.title || t) : t);
                  const status = runProgress[cid] || (isRunningSelection ? 'running' : 'queued');
                  const isFailed = status === 'failed';
                  const isDone = status === 'done';
                  const numLabel = a && (a as any).numId ? `#${(a as any).numId} ` : '';
                  return (
                    <div key={'img-'+cid} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:8, background:'#fff', borderRadius:8, border:'1px solid #f3f4f6' }}>
                      <div style={{ width:420, minWidth:200, maxWidth:520, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {genImg[cid] ? (
                          <a href={genImg[cid]} target="_blank" rel="noreferrer" style={{ position:'relative', display:'block', width: '100%' }}>
                            <img src={genImg[cid]} alt="cover" style={{ width: '100%', height: 'auto', maxHeight: 520, objectFit:'contain', borderRadius:8, border:'1px solid #e5e7eb', boxShadow:'0 10px 26px rgba(0,0,0,0.28)', background: '#fff' }} />
                            {genBusy[cid] ? (
                              <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.35)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <div style={{ width:40, height:40, borderRadius:20, border:'3px solid #111', background:'#fff' }} />
                              </div>
                            ) : null}
                          </a>
                        ) : (
                          <div style={{ width:'100%', height:120, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#9ca3af' }}>No image</div>
                        )}
                      </div>
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <input type="checkbox" checked={!!imgSel[cid]} onChange={e=>setImgSel(prev=>({ ...prev, [cid]: e.target.checked }))} />
                            <div style={{ fontSize:13, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }}>{displayedTitle}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#0d0d0eff' }}>{isFailed ? 'not found' : status}</div>
                          {isFailed ? (
                            <button className="pgBtn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setDebugOpen(prev => ({ ...prev, [cid]: !prev[cid] }))}>
                              {debugOpen[cid] ? 'hide' : 'why?'}
                            </button>
                          ) : null}
                        </div>
                        <div style={{ fontSize:12, color:'#374151' }}>{(a as any)?.excerpt || ''}</div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <input className="input" value={genPrompt[cid] || ''} onChange={(e:any) => setGenPrompt(prev => ({ ...prev, [cid]: e.target.value }))} />
                          <button className="pgBtn" disabled={!!genBusy[cid] || batchGenActive || !isSelectionReady} onClick={async () => {
                            // run a preflight selection-status check and show matched slug/title inline
                            await preflightSelectionForId(cid);
                            // then proceed to image generation (server will still validate selection)
                            generateImageForId(cid, genPrompt[cid]);
                          }}>
                            {genBusy[cid] ? 'Generating…' : (genImg[cid] ? 'Regenerate' : 'Generate')}
                          </button>
                        </div>
                        {selectionPreview[cid] ? (
                          <div style={{ fontSize:12, color:'#6b7280' }}>
                            Selection: {selectionPreview[cid]?.slug || '(no-slug)'} — {selectionPreview[cid]?.title || '(no title)'}
                          </div>
                        ) : null}
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <a target="_blank" rel="noreferrer" href={`/articles/${encodeURIComponent(((a as any) && (a as any).slug) || '')}`} className="pgBtn">Open article</a>
                          <button className="pgBtn" onClick={() => setImgSel(prev=>({ ...prev, [cid]: !prev[cid] }))}>{imgSel[cid] ? 'Unselect' : 'Select'}</button>
                          {/* Only show attach button when an image URL exists. Require inline confirmation before performing attach. */}
                          {genImg[cid] ? (
                            attachConfirm[cid] ? (
                              <>
                                <button className="pgBtn" disabled={!!attachBusy[cid]} onClick={() => { setAttachConfirm(prev => ({ ...prev, [cid]: false })); attachImageToGcsForId(cid); }}>
                                  {attachBusy[cid] ? 'Attaching…' : 'Confirm Attach'}
                                </button>
                                <button className="pgBtn" onClick={() => setAttachConfirm(prev => ({ ...prev, [cid]: false }))}>Cancel</button>
                              </>
                            ) : (
                              <button className="pgBtn" disabled={!!attachBusy[cid]} onClick={() => setAttachConfirm(prev => ({ ...prev, [cid]: true }))}>
                                {attachBusy[cid] ? 'Attaching…' : 'Attach To GCS'}
                              </button>
                            )
                          ) : null}
                        </div>
                        {genBusy[cid] ? <div className="indeterminate" style={{ marginTop:4 }} /> : null}
                      </div>
                    </div>
                  )
                }) : <div style={{ color:'#6b7280' }}>No items selected.</div>}
              </div>
            </div>

            <div className="pagination">
              <button className="pgBtn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</button>
              <span className="pgInfo">Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} — {filtered.length} results</span>
              <button className="pgBtn" onClick={() => setPage(p => Math.min(p + 1, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)))} disabled={(page + 1) * PAGE_SIZE >= filtered.length}>Next</button>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .page { max-width: 1100px; margin: 24px auto; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        .header { margin-bottom: 16px; }
        h1 { margin: 0 0 12px 0; font-size: 28px; }
        .controls { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
        .input { flex:1; padding:10px 12px; border:1px solid #ddd; border-radius:8px; }
        .select { padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fff; }
        .summaryLine { color:#666; font-size:13px; margin-top:6px; }

        .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; }
        @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .grid { grid-template-columns: repeat(1, 1fr); } }

        .card { background: #fff; border-radius:12px; padding:14px; box-shadow: 0 6px 14px rgba(20,20,30,0.06); border:1px solid rgba(16,24,40,0.04); transition: transform .12s ease, box-shadow .12s ease; display:flex; flex-direction:column; min-height:160px; }
        .card:hover { transform: translateY(-6px); box-shadow: 0 12px 30px rgba(20,20,30,0.08); }
        .titleLink { text-decoration:none; color:inherit; }
        .title { font-size:16px; margin:0 0 8px 0; line-height:1.25; color:#072f5f; }
        .meta { font-size:12px; color:#6b7280; margin-bottom:8px; display:flex; gap:8px; align-items:center; }
        .badge { background:#eef2ff; color:#3730a3; padding:4px 8px; border-radius:999px; font-size:12px; }
        .excerpt { color:#374151; font-size:14px; line-height:1.4; overflow:hidden; max-height:5.4em; }
        .empty { color:#555; padding:24px; }
  .keywords { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
  .chip { background:#f3f4f6; border:1px solid #e5e7eb; padding:6px 10px; border-radius:999px; font-size:13px; cursor:pointer; }
  .chip.active { background:#c7defa; border-color:#9ecfff; }
  .chip .count { margin-left:6px; color:#374151; opacity:0.8; font-weight:600; }
  mark { background: #ffe58a; color: #2b2b2b; padding:0 2px; border-radius:4px; }
  .pagination { display:flex; gap:12px; align-items:center; justify-content:center; margin:20px 0; }
  .pgBtn { padding:8px 12px; border-radius:8px; border:1px solid #d1d5db; background:#fff; cursor:pointer; }
  .pgBtn:disabled { opacity:0.5; cursor:not-allowed; }
  .pgInfo { color:#374151; font-size:14px; }
  .card.selected { border-color:#60a5fa; box-shadow: 0 12px 30px rgba(96,165,250,0.08); }
  .selectBtn { padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; font-size:13px }
  .selectBtn:hover { background:#f8fafc; }
  .idLabel { font-size:12px; color:#6b7280; background:#f3f4f6; padding:6px 8px; border-radius:8px; }
  /* Selection panel: ensure preview and controls are readable on dark backgrounds */
  .selectionPanel { margin-top: 14px; display:flex; gap:8px; align-items:center; justify-content:center; flex-direction:column; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e6eef8; }
  .previewRow { display:flex; gap:8px; align-items:center; }
  .previewLabel { font-size:12px; color:#065f46; font-weight:600; }
  .previewCount { font-size:13px; color:#072f5f; font-weight:700; }
  .previewChips { margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
  .previewChips.compact { gap:6px; justify-content:flex-start; }
  .previewChip { padding:6px 10px; background:#fff; color:#0f172a; border-radius:8px; border:1px solid #e5e7eb; font-size:13px; max-width: 420px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .previewChip.compact { padding:4px 8px; font-size:12px; max-width: 320px; white-space:nowrap; }
  .previewChip .title { color: inherit; }
  /* Make pagination/info text higher contrast */
  .pgInfo { color:#0f172a; font-size:14px; }
  /* Spinner */
  .spinner { width: 14px; height: 14px; border: 2px solid #93c5fd; border-top-color: transparent; border-radius: 999px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  /* Indeterminate progress */
  .indeterminate { position: relative; height: 4px; background: #e5e7eb; overflow: hidden; border-radius: 999px; }
  .indeterminate::before { content: ""; position: absolute; left: -40%; width: 40%; height: 100%; background: #93c5fd; animation: indet 1.2s ease-in-out infinite; }
  @keyframes indet { 0% { left: -40%; } 50% { left: 60%; } 100% { left: 100%; } }
      `}</style>
      <style jsx>{`
        .modalBackdrop { position: fixed; left:0; top:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; background: rgba(2,6,23,0.65); z-index:9999; }
        .modal { background: #0f172a; color: #e6eef8; padding: 18px; border-radius: 10px; width: 520px; max-width: calc(100% - 32px); box-shadow: 0 18px 60px rgba(2,6,23,0.4); border: 1px solid rgba(255,255,255,0.04); }
        .modal .pgBtn { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.08); color: #e6eef8; }
  .confirmList { margin-top:8px; display:flex; flex-direction:column; gap:8px; max-height:220px; overflow:auto; padding-right:6px }
  .confirmItem { display:flex; gap:10px; align-items:center; background: rgba(255,255,255,0.02); padding:8px 10px; border-radius:8px; }
  .confirmNum { font-weight:700; color:#93c5fd; min-width:36px }
  .confirmTitle { color: #e6eef8; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
      `}</style>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const filePath = path.join(process.cwd(), 'tmp', 'trending-aggregator-last.json');
  let articles: Article[] = [];
  const hoursParam = ctx?.query?.hours ? Number(Array.isArray(ctx.query.hours) ? ctx.query.hours[0] : ctx.query.hours) : undefined;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    articles = JSON.parse(raw);
    if (!Array.isArray(articles)) articles = [];
    // Trace read for debugging which file the UI read and its parsed count
    try {
      const tracePath = path.join(process.cwd(), 'tmp', 'ui-read-trace.log');
      const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      const info = { file: filePath, exists: !!stat, size: stat ? stat.size : null, mtime: stat ? stat.mtime.toISOString() : null, parsedCount: Array.isArray(articles) ? articles.length : 0 };
      fs.appendFileSync(tracePath, new Date().toISOString() + ' READ ' + JSON.stringify(info) + '\n', 'utf8');
    } catch (e2) { /* best-effort tracing */ }
  } catch (e) {
    articles = [];
    try {
      const tracePath = path.join(process.cwd(), 'tmp', 'ui-read-trace.log');
  fs.appendFileSync(tracePath, new Date().toISOString() + ' READ_ERROR ' + filePath + ' ' + String((e as any) && (e as any).message ? (e as any).message : e) + '\n', 'utf8');
    } catch (_) { /* ignore */ }
  }

  // Normalize source: if item comes from google-news, try to extract the original publisher
  try {
    for (const a of articles) {
      if (!a) continue;
      let s = String(a.source || '').toLowerCase().trim();
      if (s === 'google-news' || s === 'google news') {
        const summ = String(a.summary || '');
        const fontMatch = summ.match(/<font[^>]*>([^<]+)<\/font>/i);
        if (fontMatch && fontMatch[1]) {
          s = String(fontMatch[1]).toLowerCase().trim().replace(/\s+/g, '-');
        }
      }
      a.source = s || a.source;
    }
  } catch {}

  // Ensure every article has a stable id
  try {
    for (const a of articles) {
      if (!a) continue;
      if (!a.id) {
        const key = String(a.url || '') + '|' + String(a.title || '') + '|' + String(a.publishedAt || '');
        a.id = crypto.createHash('sha1').update(key).digest('hex');
      }
    }
  } catch {}

  // Deduplicate by normalized URL and cleaned title
  try {
    const seen = new Set<string>();
    const uniq: Article[] = [];
    const normalizeTitleSimple = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
    for (const a of articles) {
      if (!a) continue;
      const rawUrl = String(a.url || '');
      const urlKey = rawUrl ? rawUrl.split('?')[0].replace(/\/$/, '') : '';
      const titleKey = normalizeTitleSimple(a.title || '');
      const keys = [urlKey && `u:${urlKey}`, titleKey && `t:${titleKey}`].filter(Boolean) as string[];
      if (keys.some(k => seen.has(k))) continue;
      keys.forEach(k => seen.add(k));
      uniq.push(a);
    }
    articles = uniq;
  } catch {}

  // Sanitize summaries: decode entities and strip tags
  function sanitizeSummary(html: string) {
    try {
      const decoded = he.decode(String(html || ''));
      return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) { return String(html || ''); }
  }
  try {
    for (const a of articles) {
      if (!a) continue;
      a.summary = sanitizeSummary(a.summary || '');
    }
  } catch {}

  // Stemming helper
  // Stemming helper (lazy-load 'natural' to avoid bundling it unexpectedly)
  let _porterStemmer: any = null;
  function stemWord(w: string) {
    try {
      if (!_porterStemmer) {
        try {
          _porterStemmer = require('natural')?.PorterStemmer || (require('natural') as any);
        } catch (e) {
          _porterStemmer = null;
        }
      }
      if (_porterStemmer && typeof _porterStemmer.stem === 'function') return _porterStemmer.stem(String(w || ''));
      return String(w || '').toLowerCase();
    } catch (e) {
      return String(w || '').toLowerCase();
    }
  }

  // Tokenizer
  const stopwords = new Set(["the","is","at","which","on","and","a","an","in","to","of","for","with","by","from","as","that","this","it","are","be","was","were","has","have","but","or","its","will","can","not","we","our","they","their","you","your"]);
  function tokenize(text: string) {
    const decoded = he.decode(String(text || ''));
    return decoded.toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  }

  // Docs and frequencies
  const docs: string[][] = articles.map(a => tokenize((a.title || '') + ' ' + (a.summary || '')));
  const N = docs.length || 1;
  const df: Record<string, number> = {};
  const tfs: Record<number, Record<string, number>> = {};
  const stemLabelMap: Record<string, string> = {};

  for (let i = 0; i < docs.length; i++) {
    const tokens = docs[i];
    const seenTerms = new Set<string>();
    tfs[i] = {};
    const articleStems = new Set<string>();
    // unigrams
    for (let t=0;t<tokens.length;t++){
      const w = tokens[t];
      if (w.length<=2 || stopwords.has(w)) continue;
      const s = stemWord(w);
      if (!stemLabelMap[s]) stemLabelMap[s] = w;
      tfs[i][s] = (tfs[i][s] || 0) + 1;
      seenTerms.add(s);
      articleStems.add(s);
    }
    // bigrams & trigrams
    for (let t=0;t<tokens.length;t++){
      const w1 = tokens[t];
      if (!w1 || stopwords.has(w1)) continue;
      if (t+1 < tokens.length) {
        const b0 = w1 + ' ' + tokens[t+1];
        const parts = b0.split(' ');
        if (parts.every(x=>x.length>2 && !stopwords.has(x))) {
          const bp = parts.map(p=>stemWord(p)).join(' ');
          tfs[i][bp] = (tfs[i][bp] || 0) + 1;
          seenTerms.add(bp);
          articleStems.add(bp);
        }
      }
      if (t+2 < tokens.length) {
        const tr0 = w1 + ' ' + tokens[t+1] + ' ' + tokens[t+2];
        const parts3 = tr0.split(' ');
        if (parts3.every(x=>x.length>2 && !stopwords.has(x))) {
          const trp = parts3.map(p=>stemWord(p)).join(' ');
          tfs[i][trp] = (tfs[i][trp] || 0) + 1;
          seenTerms.add(trp);
          articleStems.add(trp);
        }
      }
    }
    for (const s of seenTerms) df[s] = (df[s] || 0) + 1;
    // attach stems to article for client-side filtering
    if (articles[i]) articles[i].stems = Array.from(articleStems);
  }

  const scores: Record<string, number> = {};
  for (let i=0;i<docs.length;i++){
    for (const term in tfs[i]){
      const tf = tfs[i][term];
      const idf = Math.log((N+1) / (1 + (df[term] || 0))) + 1;
      scores[term] = (scores[term] || 0) + tf * idf;
    }
  }

  // optionally boost terms that match Binance 24h top performers
  try {
    const binRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (binRes && binRes.ok) {
      const tickers: any[] = await binRes.json();
      const sorted = tickers.map(t=>({ symbol: String(t.symbol||''), pct: Number(t.priceChangePercent || t.priceChange || 0) })).sort((a,b)=>b.pct - a.pct);
      const top = sorted.slice(0, 40);
      const knownQuotes = ['USDT','BUSD','USDC','BTC','ETH','TUSD','EUR','GBP','TRY','BNB'];
      const topBases = new Set<string>();
      for (const t of top) {
        let s = t.symbol || '';
        for (const q of knownQuotes) {
          if (s.endsWith(q)) { s = s.slice(0, -q.length); break; }
        }
        if (s) topBases.add(s.toLowerCase());
      }
      const topStems = new Set<string>(Array.from(topBases).map(b => stemWord(b)));
      for (const st of topStems) {
        if (scores[st]) scores[st] = scores[st] * 3 + 5;
      }
      for (const b of topBases) {
        const st = stemWord(b);
        if (!stemLabelMap[st]) stemLabelMap[st] = b.toUpperCase();
      }
    }
  } catch {}

  // Ensure Binance base symbols are present as stems so they can be matched by keyword chips
  for (const a of articles) {
    if (!a || !a.source) continue;
    const s = String(a.source || '').toLowerCase();
    if (s.startsWith('binance-')) {
      const parts = s.split('-');
      if (parts.length >= 2) {
        const base = parts.slice(1).join('-');
        const cleanBase = String(base || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanBase) {
          const st = stemWord(cleanBase);
          a.stems = Array.isArray(a.stems) ? a.stems : [];
          const present = a.stems.map(x => String(x || '').toLowerCase()).includes(st);
          if (!present) a.stems.push(st);
          df[st] = (df[st] || 0) + 5;
          scores[st] = (scores[st] || 0) + 5;
          if (!stemLabelMap[st]) stemLabelMap[st] = String(base || '').toUpperCase();
        }
      }
    }
  }

  const keywords = Object.keys(scores).map(k => ({ key: k, label: stemLabelMap[k] || k, count: df[k] || 0, score: scores[k], type: (k.split(' ').length===1 ? 'unigram' : (k.split(' ').length===2 ? 'bigram' : 'trigram')) as any, boosted: false }));
  keywords.sort((a,b) => b.score - a.score);
  const topKeywords = keywords.slice(0, 20);

  const mostFreq = Object.keys(df).map(k => ({ key: k, label: stemLabelMap[k] || k, count: df[k] })).sort((a,b) => b.count - a.count).slice(0, 20);

  // assign sequential numeric ids (1-based)
  try {
    articles.sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    for (let i = 0; i < articles.length; i++) {
      if (articles[i]) articles[i].numId = i + 1;
    }
  } catch {}

  // Reduce payload size
  try {
    const RETURN_LIMIT = Number(process.env.AGG_RETURN_LIMIT) || 400;
    articles = Array.isArray(articles) ? articles.slice(0, RETURN_LIMIT) : [];
    for (const a of articles) {
      if (!a) continue;
      a.summary = String(a.summary || '').replace(/\s+/g, ' ').trim().slice(0, 360);
      if (Array.isArray(a.stems)) a.stems = a.stems.slice(0, 6);
    }
  } catch {}

  const hoursUsed = (hoursParam && [6,12,24].includes(hoursParam) ? hoursParam : undefined) ?? (Number(process.env.AGG_WINDOW_HOURS) || 12);
  return { props: { articles, topKeywords, mostFrequent: mostFreq, hoursUsed } };
};

export default AggregatorPage;
