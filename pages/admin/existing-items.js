import React, { useEffect, useState, useRef, useCallback } from 'react'
import styles from '../../styles/admin.module.css'

// Client-side normalizer: ensure a canonical published boolean and publishedAt are present
function normalizeArticleClient(row = {}) {
  try {
  // prefer canonical published flag from server when present; otherwise infer from publishedAt
  const publishedAt = row.publishedAt || row.published_at || row.published_at_iso || (row._raw && row._raw.published_at) || null;
  const serverPublishedRaw = (typeof row.published !== 'undefined') ? row.published : (typeof row.is_published !== 'undefined' ? row.is_published : (typeof row.published_flag !== 'undefined' ? row.published_flag : undefined));
  const published = (typeof serverPublishedRaw !== 'undefined' && serverPublishedRaw !== null) ? !!serverPublishedRaw : (!!publishedAt);
    return { ...row, published, publishedAt: publishedAt || null };
  } catch (e) { return { ...row, published: false, publishedAt: null }; }
}

export default function ExistingItems(){
  const devBypass = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_DEV_ALLOW_DRAFTS_WITHOUT_AUTH === '1';
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortOrder, setSortOrder] = useState('recent')
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [publishChecks, setPublishChecks] = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [forceSupabaseReads, setForceSupabaseReads] = useState(false)
  const suggestTimer = useRef(null)
  const activeSuggestionIdx = useRef(-1)
  const suggestBlurTimer = useRef(null)

  const skipAutoLoadRef = useRef(false)

  const currentSearchRef = useRef('')

  const load = useCallback(async (searchOverride) => {
    setLoading(true)
    const qs = new URLSearchParams()
    const qVal = typeof searchOverride !== 'undefined' ? searchOverride : currentSearchRef.current || ''
    if (qVal && qVal.trim().length >= 3) qs.set('q', qVal.trim())
    // apply category filters: map friendly labels to API params
    if (categoryFilter && categoryFilter !== 'All') {
      if (categoryFilter === 'Featured News') {
        // Show featured items from any category (do not force category=News)
        qs.set('featuredOnly', '1')
      } else if (categoryFilter === 'Analysis') {
        // repo uses 'Articles' as a broad category for analysis pieces
        qs.set('category', 'Articles')
      } else {
        qs.set('category', categoryFilter)
      }
    }
  qs.set('page', String(page))
  qs.set('pageSize', String(pageSize))
  // sorting: recent (most recent first) or oldest (last first)
  if (sortOrder === 'recent') qs.set('sort', 'recent')
  else qs.set('sort', 'oldest')
  try{
  // Admin should be able to view Opinions and drafts in the existing items list
  qs.set('includeOpinions','1')
  // includeDrafts=1 will allow the server to return drafts when the caller is authenticated as admin
  qs.set('includeDrafts','1')
  // allow forcing Supabase reads for testing parity between read/write backends
  if (forceSupabaseReads) qs.set('useSupabase','1')
  // request server debug info (logs) when performing admin searches
  qs.set('_debug','1')
      // prefer Supabase for admin search to reflect live DB changes
      qs.set('useSupabase','1')
  const res = await fetch('/api/articles?' + qs.toString(), { credentials: 'same-origin' })
  const json = await res.json()
  try { console.debug('[admin] /api/articles raw response', { qs: qs.toString(), json }); } catch(e){}
  // filter out Guides from the "All" view client-side so guides only appear when explicitly selected
  let fetched = (json.data || []).map(normalizeArticleClient)
  // More robust guide detection: check category/type/section fields and
        // substring 'guide' to catch variants like 'Guide', 'guides', 'guidebook'
        const detectGuide = (it) => {
          try{
            const cand = String(it.category || it.type || it.section || '').toLowerCase()
            if (!cand) return false
            return cand.includes('guide')
          }catch(e){ return false }
        }
        if (categoryFilter !== 'Guides') {
          const beforeCount = (fetched || []).length
          fetched = (fetched || []).filter(it => {
            const isGuide = detectGuide(it)
            const keep = !isGuide || (categoryFilter === 'Featured News' && !!it.featured)
            if (isGuide && !keep) {
              try{ console.debug('[admin] filtering out guide item', { id: it.id, title: it.title, category: it.category, type: it.type, section: it.section, featured: it.featured }) }catch(e){}
            }
            return keep
          })
          try{ console.debug('[admin] fetched items filtered', { beforeCount, afterCount: (fetched||[]).length, categoryFilter }) }catch(e){}
        }
  // Use server-provided ordering (server applies deterministic ordering by publishedAt/updatedAt/createdAt)
      setItems(fetched)
      try {
        // dev debug: log published fields for first few items to help diagnose mismatches
        (fetched || []).slice(0,10).forEach(it => {
          try { console.debug('[admin] item published debug', { id: it.id, published: it.published, publishedAt: it.publishedAt || it.published_at }); } catch(e){}
        })
      } catch(e){}
      setTotal(json.total ? json.total - ((json.data || []).length - fetched.length) : (fetched || []).length)
    }catch(e){ setItems([]) }
    setLoading(false)
  }, [categoryFilter, page, pageSize, sortOrder])

  // Debounced live search: when `search` changes, wait and then reset to page 1 (which triggers the main load effect)
  // NOTE: removed automatic debounced reload on every search change so typing
  // only updates the suggestions dropdown. Background results will remain
  // until the user explicitly submits (Enter/Search button) or clicks a
  // suggestion.

  // Suggest endpoint: debounce shorter (200ms) and populate suggestions dropdown
  useEffect(()=>{
    if (suggestTimer.current) { clearTimeout(suggestTimer.current); suggestTimer.current = null }
    // Require at least 4 characters for suggestions per spec
    if (!search || String(search).trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return }
    suggestTimer.current = setTimeout(async ()=>{
      try{
        setSuggestLoading(true)
        // show the dropdown while loading to avoid flicker
        setShowSuggestions(true)
        const res = await fetch(`/api/articles/suggest?q=${encodeURIComponent(String(search).trim())}&limit=12`, { credentials: 'same-origin' })
        const js = await res.json()
        try{ console.debug('[admin] /api/articles/suggest response', js) }catch(e){}
        setSuggestions(js.data || [])
        // keep dropdown visible even if empty so user sees loading/no-results state
        setShowSuggestions(true)
        activeSuggestionIdx.current = -1
      }catch(e){ setSuggestions([]); setShowSuggestions(true) }
      finally{ setSuggestLoading(false) }
    }, 200)
    return ()=>{ if (suggestTimer.current) clearTimeout(suggestTimer.current) }
  }, [search])

  useEffect(()=>{
    if (skipAutoLoadRef.current) {
      // a manual load already ran for this page change; clear the flag and skip
      skipAutoLoadRef.current = false
      return
    }
    load()
  }, [page, pageSize, categoryFilter, sortOrder, load])

  function startEdit(it){
    // open admin main page and pass id via query param to trigger edit
    try{ window.location.href = `/admin?edit=${encodeURIComponent(it.id)}` }catch(e){}
  }

  async function del(id){
    if (!confirm('Delete this article?')) return;
    try{
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) throw new Error('Delete failed')
      // refresh
      load()
    }catch(e){ alert('Delete failed') }
  }

  async function attemptPublish(it){
    try{
      // Fetch authoritative single-article from server first (some list responses are truncated)
      let full = it;
      try {
        const qs = [];
        qs.push('includeDrafts=1');
        if (forceSupabaseReads) qs.push('useSupabase=1');
        // request debug to help diagnose parity issues when needed
        qs.push('_debug=1');
        const url = `/api/articles/${encodeURIComponent(it.id)}?${qs.join('&')}`;
        const r = await fetch(url, { credentials: 'same-origin' });
        if (r.ok) {
          const j = await r.json().catch(()=>null);
          if (j) full = normalizeArticleClient(j);
        } else {
          // fall back to list item if GET fails
          try { console.debug('[admin] fetch single-article for publish failed', { id: it.id, status: r.status, statusText: r.statusText }); } catch(e){}
        }
      } catch (e) { /* ignore and use list item */ }

      // Client-side validation on the authoritative object
      const missing = [];
      if (!full) return alert('Item not found');
      if (!full.title || !String(full.title).trim()) missing.push('Title');
      if (!full.excerpt || !String(full.excerpt).trim()) missing.push('Excerpt');
      if (!full.category || !String(full.category).trim()) missing.push('Category');
      if (!full.author || !String(full.author).trim()) missing.push('Author');
      if (!full.tags || !Array.isArray(full.tags) || full.tags.length === 0) missing.push('Tags');
      if (!full.coverImage || !String(full.coverImage).trim()) missing.push('Cover photo');
      if (!full.thumbnail || !String(full.thumbnail).trim()) missing.push('Thumbnail');
      const plain = (full.content || '').replace(/<[^>]*>/g, '').trim();
      if (!plain) missing.push('Content');
      if (missing.length > 0) {
        const msg = `Cannot publish — missing required fields: ${missing.join(', ')}`;
        alert(msg);
        return;
      }
      // send publish request and use server canonical response to update UI
  const payload = { ...full, published: true };
  if (!payload.slug && payload.title) payload.slug = String(payload.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const res = await fetch(`/api/articles/${it.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
      if (!res.ok) {
        // attempt to surface server error message
        let errMsg = 'Publish failed'
        try { const j = await res.json().catch(()=>null); if (j && j.error) errMsg = j.error } catch(e){}
        throw new Error(errMsg)
      }
      const updated = await res.json().catch(()=>null)
      if (updated && updated.id) {
        // normalize fields client-side
        const norm = normalizeArticleClient(updated)
        setItems(prev => prev.map(p => p.id === norm.id ? norm : p));
        // If forceSupabaseReads is enabled, re-run a full load to ensure pagination/ordering is consistent
        if (forceSupabaseReads) {
          // ensure load uses the same params as current view
          await load()
        }
      } else {
        // fallback: reload list
        await load()
      }
    }catch(e){ 
      try {
        const msg = (e && e.message) ? e.message : 'Publish failed';
        console.error('[admin] publish error', e);
        alert(msg);
      } catch(err) { try{ alert('Publish failed') }catch(e){} }
    }
  }

  async function togglePin(it){
    // optimistic UI update
    setItems(prev => prev.map(p => p.id === it.id ? { ...p, pinned: !p.pinned } : p));
    try{
      const res = await fetch(`/api/articles/${it.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...it, pinned: !it.pinned }), credentials: 'same-origin' })
      if (!res.ok) throw new Error('Pin failed')
      load()
    }catch(e){
      alert('Pin failed')
      // rollback to server state
      load()
    }
  }

  return (
  <div className={styles.container} style={{ padding: 24 }}>
  {devBypass ? <div style={{ padding:8, background:'#fff7ed', border:'1px solid #ffd8a8', borderRadius:6, marginBottom:12 }}>Dev bypass enabled: showing drafts without auth</div> : null}
    
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
  <div style={{ position: 'relative', width: 560 }}>
  <input placeholder="Search title only (min 4 chars)" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{
      if (e.key === 'Enter'){
        // if a suggestion is highlighted, open it in a new tab instead of
        // reloading the background results. Otherwise perform an explicit
        // search (user-submitted).
        if (showSuggestions && activeSuggestionIdx.current >= 0) {
          const sel = suggestions[activeSuggestionIdx.current]
          if (sel) {
            try{ window.open(`/articles/${sel.slug}`, '_blank') }catch(e){}
            setShowSuggestions(false)
            return
          }
        }
  const v = e.target.value;
        // prevent explicit search if shorter than required length
        if (!v || String(v).trim().length < 4) {
          setShowSuggestions(false)
          return
        }
  skipAutoLoadRef.current = true; setShowSuggestions(false); setPage(1); currentSearchRef.current = v; load(v);
      } else if (e.key === 'ArrowDown'){
        // move active suggestion
        activeSuggestionIdx.current = Math.min((suggestions || []).length - 1, activeSuggestionIdx.current + 1)
        setShowSuggestions(true)
      } else if (e.key === 'ArrowUp'){
        activeSuggestionIdx.current = Math.max(-1, activeSuggestionIdx.current - 1)
        setShowSuggestions(true)
      } else if (e.key === 'Escape'){
        setShowSuggestions(false)
      } else if (e.key === 'Tab' && showSuggestions && activeSuggestionIdx.current >= 0) {
        // allow tab to select and open the suggestion in a new tab
        const sel = suggestions[activeSuggestionIdx.current]
        if (sel) { try{ window.open(`/articles/${sel.slug}`, '_blank') }catch(e){} }
      }
    }} onBlur={()=>{
      // delay hiding to allow click handlers on suggestions to run
      suggestBlurTimer.current = setTimeout(()=>{ setShowSuggestions(false) }, 150)
    }} onFocus={()=>{
      if (suggestBlurTimer.current) { clearTimeout(suggestBlurTimer.current); suggestBlurTimer.current = null }
      if ((suggestions || []).length > 0) setShowSuggestions(true)
    }} className={styles.input} autoComplete="off" />
    {showSuggestions ? (
      <div style={{ position:'absolute', left:0, right:0, zIndex:40, background:'#fff', border:'1px solid #ddd', maxHeight:380, overflowY:'auto', boxShadow:'0 6px 18px rgba(0,0,0,0.08)', padding:6 }}>
        {suggestLoading ? <div style={{ padding:12, color:'#666' }}>Loading suggestions…</div> : null}
        {(!suggestLoading && (!suggestions || suggestions.length === 0)) ? (
          <div style={{ padding:12, color:'#666' }}>No suggestions</div>
        ) : null}
        {(suggestions || []).map((s, idx) => (
          <div key={s.id} onMouseDown={(ev)=>{ ev.preventDefault(); /* prevent blur */ }} onMouseEnter={()=>{ activeSuggestionIdx.current = idx; setShowSuggestions(true) }} onClick={()=>{ try{ window.open(`/articles/${s.slug}`, '_blank') }catch(e){} setShowSuggestions(false) }} style={{ padding:12, display:'flex', gap:12, alignItems:'center', background: idx === activeSuggestionIdx.current ? '#f3f4f6' : '#fff', cursor:'pointer', borderRadius:6 }}>
            {s.thumbnail ? <img src={s.thumbnail} alt="t" style={{ width:64, height:44, objectFit:'cover', borderRadius:4 }} /> : null}
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{s.title}</div>
              <div style={{ fontSize:12, color:'#666', marginTop:6 }}>{s.slug}</div>
            </div>
          </div>
        ))}
      </div>
    ) : null}
  </div>
  <label style={{ display:'flex', alignItems:'center', gap:8, marginLeft:12 }} title="Force the server to read from Supabase for testing">
    <input type="checkbox" checked={forceSupabaseReads} onChange={e=>{ setForceSupabaseReads(!!e.target.checked); load(); }} />
    <span style={{ fontSize:12, color:'#666' }}>Force Supabase reads</span>
  </label>
  <button type="button" onClick={()=>{ const v = search; if (!v || String(v).trim().length < 4) { setShowSuggestions(false); return } skipAutoLoadRef.current = true; setPage(1); currentSearchRef.current = v; load(v) }} className={styles.btnPrimary} style={{ marginLeft:8 }}>Search</button>
  <div style={{ display: 'flex', gap: 8, marginLeft: 8, flexWrap: 'wrap' }}>
  {['All','News','Opinions','Analysis','Guides','Featured News'].map(lbl=> (
      <button key={lbl} type="button" onClick={()=>{ 
          // Clear any active search when switching categories so filters work
          currentSearchRef.current = ''
          setSearch('')
          setCategoryFilter(lbl); setPage(1);
      }} className={categoryFilter===lbl ? styles.btnPrimary : styles.btnSecondary} style={{ padding: '6px 10px' }}>{lbl}</button>
    ))}
  </div>
  {/* Items per page selector (restore 5/10/15) */}
  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
    <label className={styles.smallMuted} htmlFor="pageSizeSelect">Items per page:</label>
    <select id="pageSizeSelect" value={pageSize} onChange={e=>{ setPage(1); setPageSize(Number(e.target.value)); }} className={styles.input} style={{ width: 84 }}>
      <option value={5}>5</option>
      <option value={10}>10</option>
      <option value={15}>15</option>
      <option value={50}>50</option>
    </select>
    <label className={styles.smallMuted} htmlFor="sortSelect" style={{ marginLeft: 12 }}>Show:</label>
    <select id="sortSelect" value={sortOrder} onChange={e=>{ setPage(1); setSortOrder(e.target.value); }} className={styles.input} style={{ width: 140 }}>
      <option value="recent">Recent First</option>
      <option value="oldest">Last First</option>
    </select>
  </div>
      </div>

      {loading ? <div>Loading…</div> : (
        <div style={{ display:'grid', gap:8 }}>
          {items.map(it=> {
            // robust published detection: accept boolean true, numeric 1, common truthy strings
            function isPublishedFlag(item) {
              if (!item) return false;
              const v = item.published;
              if (v === true) return true;
              if (v === 1) return true;
              const s = (v === null || typeof v === 'undefined') ? '' : String(v).trim().toLowerCase();
              if (s && ['1','true','t','yes','y','on'].includes(s)) return true;
              // only treat explicit published timestamp fields as evidence of published state
              if (item.publishedAt || item.published_at || (item._raw && item._raw.published_at)) return true;
              return false;
            }
            const isPublished = isPublishedFlag(it);
            return (
            <div key={it.id} className={styles.itemCard}>
              <div style={{ display:'flex', gap:12, alignItems:'center', width:'100%' }}>
                <div style={{ flex:1 }}>
                  <div className={styles.itemTitle}>{it.title}</div>
                  <div className={styles.smallMuted}>{it.excerpt}</div>
                  <div className={styles.smallMuted} style={{ marginTop:6 }}>
                    {isPublished ? 'Published' : 'Draft'} • {it.author || '—'}
                    {/* render tags inline after author */}
                    {(it.tags || []).slice(0,5).map((t, idx) => (
                      <span key={t + idx} className={styles.itemTag}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" onClick={()=>startEdit(it)} className={styles.btnSecondary}>Edit</button>
                    {isPublished ? (
                      <a href={`/${(it.category||'articles').toLowerCase()}/articles/${it.slug}`} target="_blank" rel="noreferrer" className={styles.btnPrimary}>Open</a>
                    ) : (
                      <button type="button" onClick={()=>attemptPublish(it)} className={styles.btnPrimary}>Publish</button>
                    )}
                    {isPublished ? (
                      <button type="button" onClick={()=>togglePin(it)} className={it.pinned ? styles.btnPrimary : styles.btnSecondary}>{it.pinned ? 'Unpin' : 'Pin'}</button>
                    ) : null}
                    <button type="button" onClick={()=>del(it.id)} className={styles.btnDanger}>Delete</button>
                  </div>
                  {/* thumbnail on the right of the action group */}
                  {it.thumbnail ? <img src={it.thumbnail} alt="thumb" className={styles.itemThumb} /> : null}
                </div>
              </div>
            </div>
          )})}

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>{ setPage(Math.max(1, page-1)); load() }} className={styles.btnSecondary} disabled={page<=1}>Prev</button>
            <div className={styles.smallMuted}>Page {page} — {total} items</div>
            <button onClick={()=>{ setPage(page+1); load() }} className={styles.btnSecondary} disabled={page*pageSize >= total}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
