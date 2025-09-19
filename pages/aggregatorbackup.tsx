import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GetServerSideProps } from 'next';
import React, { useMemo, useState, useEffect } from 'react';
import { PorterStemmer } from 'natural';
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
  orig_url?: string;
}

interface AggregatorProps {
  articles: Article[];
  topKeywords: { key: string; label: string; count: number; score?: number; type?: 'unigram'|'bigram'|'trigram' }[];
  mostFrequent?: { key: string; label: string; count: number }[];
}

const AggregatorPage: React.FC<AggregatorProps> = ({ articles, topKeywords, mostFrequent }) => {
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
  const [showLog, setShowLog] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<Article[]>([]);
  async function runSelection(ids: string[]) {
    if (!ids || ids.length === 0) return;
    setIsRunningSelection(true);
    setActionStatus('Queuing selection...');
    setPipelineSummary(null);
    setPipelineLogLines([]);
    try {
      const resp = await fetch('/api/run-selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const j = await resp.json();
      if (!resp.ok) { setActionStatus(`Pipeline error: ${j.error || resp.statusText}`); setIsRunningSelection(false); return }
      const started = j.startedAt || Date.now();
      setPipelineStartedAt(started);
      let msg = `Queued ${j.count} item(s). Waiting for pipeline to finish...`;
      if (j.invocation) msg = `${msg} (invocation: ${j.invocation})`;
      setActionStatus(msg);

      // poll log and status
      const deadline = Date.now() + 1000 * 60 * 5; // 5 minutes
      let logTimer: any = null;
      const startLogPoll = () => {
        const lp = async () => {
          try {
            const sinceParam = started ? `&since=${started}` : '';
            const lr = await fetch(`/api/pipeline-log?lines=80${sinceParam}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            const lj = await lr.json();
            if (lj && lj.lines) setPipelineLogLines(lj.lines.filter(Boolean));
          } catch (e) { /* ignore */ }
          logTimer = setTimeout(lp, 2000);
        };
        lp();
      };
      startLogPoll();

      const poll = async () => {
        try {
          const q = new URL('/api/pipeline-status', location.origin);
          q.searchParams.set('since', String(started));
          const r = await fetch(q.toString(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
          const jj = await r.json();
          if (jj && jj.found) {
            setPipelineSummary(jj.summary);
            setActionStatus(`Pipeline finished: ${jj.summary.count} upserted`);
            if (logTimer) clearTimeout(logTimer);
            setIsRunningSelection(false);
            return;
          }
        } catch (e) { /* ignore */ }
        if (Date.now() < deadline) setTimeout(poll, 2000);
        else {
          if (logTimer) clearTimeout(logTimer);
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
  const [isRunningSelection, setIsRunningSelection] = useState(false);

  // persist selectedIds in localStorage so selection survives navigation/reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aggregator:selectedIds');
      if (raw) {
        const arr = JSON.parse(raw || '[]');
        if (Array.isArray(arr) && arr.length > 0) {
          // keep only ids that exist in current feed
          const valid = (arr as string[]).filter(id => (articles || []).some(a => a && a.id === id));
          if (valid.length > 0) setSelectedIds(valid);
          else localStorage.removeItem('aggregator:selectedIds');
        }
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [articles]);

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

  useEffect(() => {
    try {
      if (selectedIds && selectedIds.length > 0) localStorage.setItem('aggregator:selectedIds', JSON.stringify(selectedIds));
      else localStorage.removeItem('aggregator:selectedIds');
    } catch (e) {
      // ignore storage errors
    }
  }, [selectedIds]);

  const detectedSources = useMemo(() => {
    const s = new Set<string>();
    (articles || []).forEach(a => { if (a && a.source) s.add(String(a.source).toLowerCase()); });
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

  return (
    <div className="page">
      <header className="header">
        <h1>Aggregated Headlines</h1>
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
                } else {
                  newIds.push(...selectedIds);
                }
                if (newIds.length === 0) {
                  setActionStatus('No matching ids found to run. Select article cards or enter indexes/ids.');
                  return;
                }
                // show confirmation modal with the resolved ids
                setConfirmIds(Array.from(new Set(newIds)));
                setShowConfirm(true);
              }}>Apply</button>
              <button className="pgBtn" onClick={() => { setSelectionInput(''); setSelectedIds([]); }}>Clear</button>
            </div>

            {actionStatus ? <div style={{ textAlign: 'center', marginTop: 8, color: '#065f46' }}>{actionStatus}</div> : null}

            {/* Compact pipeline status card */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{isRunningSelection ? 'Running' : (pipelineSummary ? 'Completed' : (actionStatus ? 'Status' : 'Idle'))}</div>
                <div style={{ color: '#334155', fontSize: 13 }}>{actionStatus || (pipelineSummary ? `${pipelineSummary.count} items` : 'No pipeline activity')}</div>
                {pipelineLogLines && pipelineLogLines.length ? (
                  <button className="pgBtn" onClick={() => setShowLog(s => !s)} style={{ marginLeft: 6 }}>{showLog ? 'Hide log' : 'Show log'}</button>
                ) : null}
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
                        const found = (articles || []).find(a => String(a.id) === String(cid) || String(a.url) === String(cid) || String(a.orig_url) === String(cid));
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

            {showLog && pipelineLogLines && pipelineLogLines.length ? (
              <div style={{ marginTop: 8, background: '#0f172a', color: '#e6eef8', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Live pipeline log</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>{pipelineLogLines.join('\n')}</pre>
              </div>
            ) : null}

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
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{it.slug || '(no slug)'}</div>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>{it.excerpt || ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <a target="_blank" rel="noreferrer" href={`/articles/${it.slug}`} className="pgBtn">View debug</a>
                        <a target="_blank" rel="noreferrer" href={`/_next/static/media/${it.slug}.html`} className="pgBtn">Open</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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

export const getServerSideProps: GetServerSideProps = async () => {
  const filePath = path.join(process.cwd(), 'tmp', 'trending-aggregator-last.json');
  let articles: Article[] = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    articles = JSON.parse(raw);
    if(!Array.isArray(articles)) articles = [];

    // Normalize source: if item comes from google-news, try to extract the original publisher
  for (const a of articles) {
      if (!a) continue;
      let s = String(a.source || '').toLowerCase().trim();
      if (s === 'google-news' || s === 'google news') {
        const summ = String(a.summary || '');
        const fontMatch = summ.match(/<font[^>]*>([^<]+)<\/font>/i);
        if (fontMatch && fontMatch[1]) {
          s = String(fontMatch[1]).toLowerCase().trim().replace(/\s+/g, '-');
        } else {
          const title = String(a.title || '');
          const titleMatch = title.match(/-\s*([^\-]+)$/);
          if (titleMatch && titleMatch[1]) {
            s = String(titleMatch[1]).toLowerCase().trim().replace(/\s+/g, '-');
          }
        }
      }
  // normalize spacing/hyphens and set back
  s = s.replace(/\s+/g, '-');
  a.source = s;
    }

    // Ensure each article has a stable id. Use SHA1 of url+title+publishedAt when missing.
    for (const a of articles) {
      if (!a) continue;
      if (!a.id) {
        const key = String(a.url || '') + '|' + String(a.title || '') + '|' + String(a.publishedAt || '');
        a.id = crypto.createHash('sha1').update(key).digest('hex');
      }
    }

    // Deduplicate items: mark both normalized URL (strip query/trailing slash) and cleaned title as seen.
    // This helps catch duplicates where Google News points to a news redirect while the original source has the canonical URL.
    const seen = new Set<string>();
    const uniq: Article[] = [];
    const normalize = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
    for (const a of articles) {
      if (!a) continue;
      const rawUrl = String(a.url || '');
      const urlKey = rawUrl ? rawUrl.split('?')[0].replace(/\/$/, '') : '';
      const titleKey = normalize(a.title || '');
      // if either url or title already seen, skip
      if ((urlKey && seen.has(urlKey)) || (titleKey && seen.has(titleKey))) continue;
      // otherwise add article and mark both keys as seen (if present)
      if (urlKey) seen.add(urlKey);
      if (titleKey) seen.add(titleKey);
      uniq.push(a);
    }
    articles = uniq;
    // keep only articles from the last N hours (configurable via AGG_WINDOW_HOURS, default 24)
    try {
      const now = Date.now();
      // default aggregation window: 12 hours (can be overridden with AGG_WINDOW_HOURS env)
      const hours = Number(process.env.AGG_WINDOW_HOURS) || 12;
      const windowMs = hours * 60 * 60 * 1000;
      articles = articles.filter(a => {
        const t = a && a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        return Boolean(t && (now - t) <= windowMs);
      });
    } catch (e) {
      // if parsing fails, fall back to using the full list
    }
  } catch (e) {
    // file missing or parse error -> return empty list
    articles = [];
  }
    // Sanitize summaries: decode HTML entities and strip tags to avoid unsafe HTML rendering
    function sanitizeSummary(html: string) {
      try {
        const decoded = he.decode(String(html || ''));
        // strip tags
        return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      } catch (e) { return String(html || ''); }
    }

    for (const a of articles) {
      if (!a) continue;
      a.summary = sanitizeSummary(a.summary || '');
    }

    // Use natural's PorterStemmer for accurate stemming
    function stemWord(w: string) {
      try {
        return PorterStemmer.stem(String(w || ''));
      } catch (e) {
        return String(w || '').toLowerCase();
      }
    }

    // Advanced keyword extraction: TF-IDF-like scoring for unigrams, bigrams, trigrams using stems
  const stopwords = new Set(["the","is","at","which","on","and","a","an","in","to","of","for","with","by","from","as","that","this","it","are","be","was","were","has","have","but","or","its","will","can","not","we","our","they","their","you","your"]);

  function tokenize(text: string) {
  // decode HTML entities first (turns &nbsp; into a real space, etc.)
  const decoded = he.decode(String(text || ''));
  return decoded.toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  }

  // per-doc term frequencies and global doc frequencies
  const docs: string[][] = articles.map(a => tokenize((a.title || '') + ' ' + (a.summary || '')));
  const N = docs.length || 1;
  const df: Record<string, number> = {};
  const tfs: Record<number, Record<string, number>> = {};
  const stemLabelMap: Record<string, string> = {};

  for (let i = 0; i < docs.length; i++) {
    const tokens = docs[i];
    const seen = new Set<string>();
    tfs[i] = {};
    const articleStems = new Set<string>();
    // unigrams
    for (let t=0;t<tokens.length;t++){
      const w = tokens[t];
      if (w.length<=2 || stopwords.has(w)) continue;
      const s = stemWord(w);
  // prefer original surface word as label if not set
  if (!stemLabelMap[s]) stemLabelMap[s] = w;
      tfs[i][s] = (tfs[i][s] || 0) + 1;
      seen.add(s);
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
          seen.add(bp);
          articleStems.add(bp);
        }
      }
      if (t+2 < tokens.length) {
        const tr0 = w1 + ' ' + tokens[t+1] + ' ' + tokens[t+2];
        const parts3 = tr0.split(' ');
        if (parts3.every(x=>x.length>2 && !stopwords.has(x))) {
          const trp = parts3.map(p=>stemWord(p)).join(' ');
          tfs[i][trp] = (tfs[i][trp] || 0) + 1;
          seen.add(trp);
          articleStems.add(trp);
        }
      }
    }
    for (const s of seen) df[s] = (df[s] || 0) + 1;
    // attach stems to article for client-side filtering
    articles[i].stems = Array.from(articleStems);
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
      // compute percent change and sort desc
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
      // create stem set from base symbols
      const topStems = new Set<string>(Array.from(topBases).map(b => stemWord(b)));
      // boost matching scores
      for (const st of topStems) {
        if (scores[st]) scores[st] = scores[st] * 3 + 5; // boost multiplier + additive
      }
      // ensure labels for these stems exist
      for (const b of topBases) {
        const st = stemWord(b);
        if (!stemLabelMap[st]) stemLabelMap[st] = b.toUpperCase();
      }
    }
  } catch (e) {
    // ignore network errors; scoring proceeds without boost
  }

  // Ensure Binance base symbols are present as stems so they can be matched by keyword chips.
  // For example, source 'binance-MYX' -> base 'MYX' -> stem 'myx' will be attached to the article.stems
  for (const a of articles) {
    if (!a || !a.source) continue;
    const s = String(a.source || '').toLowerCase();
    if (s.startsWith('binance-')) {
      const parts = s.split('-');
      if (parts.length >= 2) {
        // join remaining parts in case symbol contains dashes
        const base = parts.slice(1).join('-');
        const cleanBase = String(base || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanBase) {
          const st = stemWord(cleanBase);
          a.stems = Array.isArray(a.stems) ? a.stems : [];
          const present = a.stems.map(x => String(x || '').toLowerCase()).includes(st);
          if (!present) a.stems.push(st);
          // make sure df and scores include this stem so it appears in top lists
          df[st] = (df[st] || 0) + 1;
          scores[st] = (scores[st] || 0) + 5; // small additive boost
          if (!stemLabelMap[st]) stemLabelMap[st] = String(base || '').toUpperCase();
        }
      }
    }
  }

  const keywords = Object.keys(scores).map(k => ({ key: k, label: stemLabelMap[k] || k, count: df[k] || 0, score: scores[k], type: k.split(' ').length===1 ? 'unigram' : (k.split(' ').length===2 ? 'bigram' : 'trigram') as any, boosted: false }));
  keywords.sort((a,b) => b.score - a.score);
  const topKeywords = keywords.slice(0, 30);

  // most frequent by document frequency (df)
  const mostFreq = Object.keys(df).map(k => ({ key: k, label: stemLabelMap[k] || k, count: df[k] })).sort((a,b) => b.count - a.count).slice(0, 30);

  // debug a specific example term
  const TERM = 'solana';
  const TERM_STEM = stemWord(TERM);
  const dfVal = df[TERM_STEM] || 0;
  const scoreVal = scores[TERM_STEM] || 0;
  const inTop = topKeywords.some(k=>k.key === TERM_STEM);
  const inFreq = mostFreq.some(k=>k.key === TERM_STEM);

  // debug for MYX specifically
  const MYX = 'MYX';
  const MYX_STEM = stemWord(MYX.toLowerCase());
  const myxDf = df[MYX_STEM] || 0;
  const myxScore = scores[MYX_STEM] || 0;
  const myxInTop = topKeywords.some(k=>k.key===MYX_STEM);
  const myxInFreq = mostFreq.some(k=>k.key===MYX_STEM);
  const myxMatches = articles.filter(a => (a.stems || []).map(s=>String(s||'')).includes(MYX_STEM)).map(a=>({ id: a.id, title: a.title, source: a.source }));

  // assign sequential numeric ids (1-based) for the UI so records are addressable by index
  try {
    articles.sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    for (let i = 0; i < articles.length; i++) {
      if (articles[i]) articles[i].numId = i + 1;
    }
  } catch (e) {
    // ignore
  }

  return { props: { articles, topKeywords, mostFrequent: mostFreq, debugTerm: { term: TERM, stem: TERM_STEM, df: dfVal, score: scoreVal, inTop, inFreq }, debugMYX: { term: MYX, stem: MYX_STEM, df: myxDf, score: myxScore, inTop: myxInTop, inFreq: myxInFreq, matches: myxMatches } } };
};

export default AggregatorPage;
