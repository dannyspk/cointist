import React, { useEffect, useState, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import styles from '../styles/admin.module.css'
// list of authors used by the admin dropdown
const AUTHORS = [
  'Ayesha Rahman',
  'Arjun Mehta',
  'Nila Perera',
  'Hana Sato',
  'Minh Nguyen',
  'Camila Duarte',
  'Santiago Álvarez',
  'Emilia Nowak',
  'Luca De Santis',
  'Freja Lindholm'
];
// News desk authors (recently added)
const NEWS_AUTHORS = [
  'Zara Rauf',
  'Rohan Khanna',
  'Kai Yamamoto',
  'Marta Silva',
  'Tomasz Mazur',
  'Luz Valdés'
];
export default function Admin() {
  // helper to create slugs from titles
  function slugifyTitle(t){
    if (!t) return '';
    return String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  }
  // Minimal guide template used to prefill the admin form when creating a new Guide
  function guideTemplate(title = 'New Guide'){
    return {
      title: title,
      category: 'Guides',
      excerpt: '',
      content: `<section class="hero">
  <div class="hero-inner">
    <div class="hero-left">
      <div class="crumbs"><a href="/guides">Guides</a></div>
      <h1>${title}</h1>
    </div>
    <div class="meta"><div class="share" aria-label="Share"></div></div>
  </div>
</section>
<article>
  <h2 id="why-now">Why this guide?</h2>
  <p>Start writing your guide here.</p>
</article>
`,
      published: false,
      tags: ['Guides']
    }
  }
  // safer fetch wrapper that logs full context on network failures
  async function safeFetch(url, opts) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      // Log helpful diagnostics for the developer
      try {
        console.error('[admin] fetch failed', {
          url,
          opts,
          err,
          online: (typeof navigator !== 'undefined') ? navigator.onLine : 'unknown',
          location: (typeof window !== 'undefined') ? window.location.href : 'ssr'
        });
      } catch (e) { /* ignore logging errors */ }
      try { setStatus({ message: 'Network request failed: ' + String(err.message || err), type: 'error' }); } catch(e){}

      // Client-side improvement: if the caller passed a relative path, try an absolute fallback
      // This helps when the app is served behind a proxy or basePath that causes relative fetches to fail.
      if (typeof window !== 'undefined' && typeof url === 'string' && url.startsWith('/')) {
        try {
          const abs = window.location.origin + url;
          const r = await fetch(abs, opts);
          return r;
        } catch (err2) {
          try { console.error('[admin] absolute fetch fallback failed', { abs: (typeof window !== 'undefined' ? window.location.origin + url : undefined), err2 }); } catch (e) {}
        }
      }

      throw err;
    }
  }
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'News', excerpt: '', content: '', published: false, tags: [], ogTitle: '', ogDescription: '', ogImage: '', scheduledAt: null, featuredOnly: false });
  const [tagsInput, setTagsInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const contentRef = useRef(null);
  const editorWrapperRef = useRef(null);
  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: true })],
  // Avoid SSR hydration mismatch by deferring immediate render on the server
  immediatelyRender: false,
  content: form.content || '',
  onUpdate: ({ editor }) => {
      setForm(prev => ({ ...prev, content: editor.getHTML() }));
    }
  });
  const [htmlMode, setHtmlMode] = useState(false);

  // keep TipTap editor in sync when form.content changes (e.g., loading an article)
  useEffect(()=>{
    if (editor && typeof form.content === 'string') {
      const current = editor.getHTML();
      if (form.content !== current) editor.commands.setContent(form.content || '', false);
    }
  }, [form.content, editor]);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadConfirmed, setUploadConfirmed] = useState(false);
  const [authorsList, setAuthorsList] = useState([]);
  const [mediaModal, setMediaModal] = useState({ visible: false, loading: false, files: [], target: null });
  const coverInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const insertInputRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const [imgOverlay, setImgOverlay] = useState({ visible: false, top: 0, left: 0, target: null });
  // Autosave state
  const AUTOSAVE_KEY = 'cointist_admin_autosave_v1';
  const AUTOSAVE_INTERVAL_MS = 15000; // save every 15s
  const autosaveTimerRef = useRef(null);
  const [autosaveAvailable, setAutosaveAvailable] = useState(false);
  // lastCreated previously held raw API debug responses; removed to avoid leaking internal data to UI
  const publishedRef = useRef(false);
  const [publishChecks, setPublishChecks] = useState({});
  const [confirmPublish, setConfirmPublish] = useState({ open: false, id: null });
  const [subCategory, setSubCategory] = useState('');
  // versions feature removed — keep code simpler

  // helper to push a toast with auto-dismiss and animation
  function pushToast(message, type='info', ttl=3000){
    const id = Date.now() + Math.random();
    const t = { id, message, type };
    setToasts(prev => [t, ...prev]);
    setTimeout(()=>{
      // trigger removal animation then remove
      setToasts(prev => prev.filter(x=>x.id!==id));
    }, ttl);
  }

  async function load(){
    setLoading(true);
    const qs = new URLSearchParams();
    if (sectionFilter && sectionFilter !== 'All') qs.set('category', sectionFilter);
  if (debouncedSearch) qs.set('q', debouncedSearch);
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
  // Admin UI should be able to see all categories, including Opinions
  qs.set('includeOpinions', '1');
    const headers = password ? { 'x-cms-password': password } : {};
  try {
  const res = await safeFetch('/api/articles?' + qs.toString(), { headers, credentials: 'same-origin' });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      setStatus({ message: `Error fetching articles: ${res.status} ${res.statusText} ${txt ? '- ' + txt.slice(0,200) : ''}`, type: 'error' });
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const json = await res.json().catch(async (e)=>{ const t = await res.text().catch(()=>null); throw new Error('Invalid JSON from /api/articles: ' + (t || String(e))); });
    // When viewing 'All', hide Guides locally; show Guides only when the Guides filter is selected.
    let fetched = json.data || [];
    if (sectionFilter === 'All') {
      fetched = (fetched || []).filter(it => String(it.category || '').toLowerCase() !== 'guides');
    }
    setItems(fetched);
    setTotal(json.total || fetched.length);
  } catch (e) {
    setStatus({ message: String(e.message || e), type: 'error' });
    setItems([]);
    setTotal(0);
    setLoading(false);
    return;
  }
    // fetch counts
    try {
  const cRes = await safeFetch('/api/admin/counts', { credentials: 'same-origin' });
  const cj = await cRes.json();
      setCounts(cj.counts || {});
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  useEffect(()=>{ load(); }, []);

  // autosave: periodically store current form to localStorage
  useEffect(()=>{
    try{
      // detect saved draft on mount
      const saved = (typeof window !== 'undefined') ? window.localStorage.getItem(AUTOSAVE_KEY) : null;
      if (saved) setAutosaveAvailable(true);
    }catch(e){}
    // set up interval
    autosaveTimerRef.current = setInterval(()=>{
      try{
        const payload = { ts: Date.now(), form }; // snapshot
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      }catch(e){}
    }, AUTOSAVE_INTERVAL_MS);
    return ()=>{ try{ if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current); }catch(e){} }
  }, [])
  // debounce search input so we don't reload on every keystroke; require 3+ chars before searching
  useEffect(()=>{
    const v = (search || '').trim();
    const timer = setTimeout(()=>{
      if (v.length >= 3) setDebouncedSearch(v); else setDebouncedSearch('');
    }, 350);
    return ()=>clearTimeout(timer);
  }, [search]);

  useEffect(()=>{ load(); }, [debouncedSearch, page, pageSize, sectionFilter, password]);

  const [setupNeeded, setSetupNeeded] = useState(false);
  useEffect(()=>{
  // check setup and login status (use safeFetch for better error reporting)
  safeFetch('/api/admin/setup', { credentials: 'same-origin' }).then(r=>r.json()).then(j=>setSetupNeeded(!!j.setupNeeded)).catch(()=>{});
  // check if logged in via cookie
  safeFetch('/api/admin/me', { credentials: 'same-origin' }).then(r=>{ if (r.ok) setLoggedIn(true); else setLoggedIn(false); }).catch((err)=>{ setLoggedIn(false); setStatus({ message: String(err.message || err), type: 'error' }); });
  },[]);

  // fetch authors JSON (same source as single-article editor)
  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try {
        const res = await safeFetch('/api/authors', { credentials: 'same-origin' });
        if (!mounted) return;
        if (!res.ok) return setAuthorsList([]);
        const j = await res.json().catch(()=>[]);
        if (!mounted) return;
        setAuthorsList(Array.isArray(j) ? j : []);
      } catch (e) {
        if (mounted) setAuthorsList([]);
      }
    })();
    return ()=>{ mounted = false };
  }, []);

  // If ?edit=<id> is present in the URL, load that article into the editor
  useEffect(()=>{
    try{
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search || '');
      const editId = params.get('edit');
      if (!editId) return;
      // fetch the article and populate the form via edit()
      safeFetch(`/api/articles/${encodeURIComponent(editId)}`, { credentials: 'same-origin' })
        .then(r=>{ if (!r.ok) throw new Error('not found'); return r.json(); })
        .then(item=>{ try { edit(item); setStatus({ message: 'Loaded item for editing', type: 'info' }); } catch(e){} })
        .catch(()=> setStatus({ message: 'Unable to load item for editing', type: 'error' }));
    }catch(e){}
  }, []);

  // auto-dismiss status toasts after 3s
  useEffect(()=>{
    if (!status || !status.message) return;
    const t = setTimeout(()=> setStatus({ message: '', type: '' }), 3000);
    return ()=>clearTimeout(t);
  }, [status]);

  // whenever status changes, also push a toast for consistent feedback
  useEffect(()=>{
    try{
      if (status && status.message) {
        // map status types to toast types
        const type = status.type || 'info';
        pushToast(status.message, type, 3000);
      }
    }catch(e){}
  }, [status]);

  async function save(e){
    e?.preventDefault();
    setStatus({ message: 'Saving…', type: 'info' });
  // Commit tagsInput into an effective form object so tags are saved even if input wasn't blurred
  const parsedTags = (tagsInput || '').split(',').map(s=>s.trim()).filter(Boolean);
  const dedupTags = [];
  parsedTags.forEach(t=>{ if (!dedupTags.includes(t)) dedupTags.push(t); });
  const effectiveForm = { ...form, tags: dedupTags.length ? dedupTags : (Array.isArray(form.tags) ? form.tags : (form.tags ? [form.tags] : [])) };
    // client-side validation for required fields
    function validateForm(f){
  // Only enforce required fields when publishing; drafts may be saved without them
  const ff = f || form;
  if (!publishedRef.current) return true;
  if (!ff.title || !ff.title.trim()) { pushToast('Title is required', 'error'); return false; }
  if (!ff.excerpt || !ff.excerpt.trim()) { pushToast('Excerpt is required', 'error'); return false; }
  if (!ff.category || !ff.category.trim()) { pushToast('Category is required', 'error'); return false; }
  if (!ff.author || !ff.author.trim()) { pushToast('Author is required', 'error'); return false; }
  // tags should be a non-empty array
  if (!ff.tags || !Array.isArray(ff.tags) || ff.tags.length === 0) { pushToast('At least one tag is required', 'error'); return false; }
  if (!ff.coverImage || !ff.coverImage.trim()) { pushToast('Cover photo is required', 'error'); return false; }
  if (!ff.thumbnail || !ff.thumbnail.trim()) { pushToast('Thumbnail is required', 'error'); return false; }
  // content: strip HTML and check text length
  const plain = (ff.content || '').replace(/<[^>]*>/g, '').trim();
  if (!plain) { pushToast('Content is required', 'error'); return false; }
  return true;
    }
    if (!validateForm(effectiveForm)) { setStatus({ message: 'Validation failed', type: 'error' }); return; }
    try {
      if (editingId) {
        // optimistic update in UI
  setItems(prev => prev.map(it => it.id === editingId ? { ...it, ...effectiveForm } : it));
  const opts = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...effectiveForm, published: !!publishedRef.current, slug: effectiveForm.slug || (publishedRef.current ? slugifyTitle(effectiveForm.title) : undefined) }), credentials: 'same-origin' };
        if (password) opts.headers['x-cms-password'] = password;
  const res = await safeFetch(`/api/articles/${editingId}`, opts);
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
  let updated = await res.json();
  // server response handled internally; do not expose raw API response in the admin UI
  updated.published = !!updated.published;
  if (!updated.slug && updated.title) updated.slug = slugifyTitle(updated.title);
  // replace with server canonical version (ensures slug, publishedAt etc.)
  setItems(prev => prev.map(it => it.id === editingId ? updated : it));
  setStatus({ message: 'Saved changes', type: 'success' });
      setForm({ title:'', category:'News', excerpt:'', content:'', published:false, author: '' });
        setTagsInput('');
        setEditingId(null);
  // show toast indicating updated status (do not open new window)
  try { pushToast(`Updated: ${updated.title} (${updated.published ? 'Published' : 'Draft'})`, 'success', 3000); } catch(e) {}
      } else {
        setStatus({ message: 'Creating…', type: 'info' });
        // create and reload list (simpler than optimistic create)
  const opts = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...effectiveForm, published: !!publishedRef.current, slug: effectiveForm.slug || (publishedRef.current ? slugifyTitle(effectiveForm.title) : undefined) }), credentials: 'same-origin' };
  publishedRef.current = false;
  publishedRef.current = false;
        if (password) opts.headers['x-cms-password'] = password;
  const res = await safeFetch('/api/articles', opts);
        if (!res.ok) {
          // attempt to capture server response body for better diagnostics
          let bodyText = null;
          try { bodyText = await res.text(); } catch(e){}
          const msg = `Create failed: ${res.status} ${res.statusText} ${bodyText ? '- ' + bodyText.slice(0,600) : ''}`;
          console.error('[admin] create article failed', { status: res.status, statusText: res.statusText, body: bodyText, opts });
          throw new Error(msg);
        }
  let created = await res.json();
  // server response handled internally; do not expose raw API response in the admin UI
  // normalize returned object
  created.published = !!created.published;
  if (!created.slug && created.title) created.slug = slugifyTitle(created.title);
  // insert created item into list so it appears immediately (use server canonical)
  setItems(prev => [created, ...(prev || [])]);
  setTotal(t => (t || 0) + 1);
  setStatus({ message: 'Article created', type: 'success' });
  setForm({ title:'', category:'News', excerpt:'', content:'', published:false, author: '' });
  setTagsInput('');
        // clear autosave after successful create
        try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(AUTOSAVE_KEY); setAutosaveAvailable(false); } catch(e){}
        // ensure UI is in sync with server (reload list in background)
        load().catch(()=>{});
  // debug toast: show slug and published state; do not open new window
  try { pushToast(`Created: ${created.title} (${created.published ? 'Published' : 'Draft'})`, 'success', 4000); } catch(e){}
      }
    } catch (err) {
      setStatus({ message: String(err.message || err), type: 'error' });
      // rollback optimistic update by reloading
      await load();
    }
  }

  function restoreAutosave(){
    try{
      const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(AUTOSAVE_KEY) : null;
      if (!raw) return setStatus({ message: 'No autosave found', type: 'error' });
      const parsed = JSON.parse(raw);
      if (parsed && parsed.form) {
        setForm(parsed.form);
        setTagsInput((parsed.form.tags || []).join(', '));
        publishedRef.current = !!parsed.form.published;
        setStatus({ message: 'Restored autosave', type: 'success' });
      }
    }catch(e){ setStatus({ message: 'Failed to restore autosave', type: 'error' }) }
  }

  function clearAutosave(){
    try{ if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(AUTOSAVE_KEY); setAutosaveAvailable(false); setStatus({ message: 'Autosave cleared', type: 'info' }); }catch(e){ setStatus({ message: 'Failed to clear autosave', type: 'error' }) }
  }

  // versions removed — no-op

  async function doBackup() {
    setStatus({ message: 'Creating backup…', type: 'info' });
    try {
      const headers = password ? { 'x-cms-password': password } : {};
  const res = await safeFetch('/api/admin/backup', { method: 'POST', headers, credentials: 'same-origin' });
      const j = await res.json().catch(()=>({ error: 'network' }));
      if (!res.ok) throw new Error(j.error || 'Backup failed');
      setStatus({ message: `Backup created: ${j.file}`, type: 'success' });
      pushToast('Backup created', 'success', 4000);
    } catch (e) {
      setStatus({ message: String(e.message || e), type: 'error' });
    }
  }

  async function doLogout() {
    try {
  await safeFetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) { /* ignore */ }
    setLoggedIn(false);
    setUsername('');
    setPassword('');
    setStatus({ message: 'Logged out', type: 'info' });
  }

  async function doSetup() {
    if (!username || !password) return setStatus({ message: 'username and password required', type: 'error' });
    setStatus({ message: 'Creating admin account…', type: 'info' });
    try {
  const res = await safeFetch('/api/admin/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'same-origin' });
      const j = await res.json().catch(()=>({ error: 'network' }));
      if (!res.ok) return setStatus({ message: j.error || 'Setup failed', type: 'error' });
      // auto-login after setup
  const login = await safeFetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'same-origin' });
      if (!login.ok) return setStatus({ message: 'Setup created — please log in', type: 'success' });
      setLoggedIn(true);
      setStatus({ message: 'Admin account created and logged in', type: 'success' });
    } catch (e) { setStatus({ message: String(e.message || e), type: 'error' }); }
  }

  function edit(item){
    const pub = !!item.published;
    publishedRef.current = pub;
    setForm({
      title: item.title,
      category: item.category,
      excerpt: item.excerpt || '',
      content: item.content || '',
      published: pub,
      coverImage: item.coverImage || '',
      thumbnail: item.thumbnail || '',
  subcategory: item.subcategory || '',
      author: item.author || '',
      tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []),
      ogTitle: item.ogTitle || '',
      ogDescription: item.ogDescription || '',
      ogImage: item.ogImage || '',
  scheduledAt: item.scheduledAt || null,
      pinned: !!item.pinned,
      featuredOnly: !!item.featuredOnly
    });
  setTagsInput(Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags ? String(item.tags) : ''));
    setSubCategory(item.subcategory || '');
    setEditingId(item.id);
  }

  // show a small status when entering edit mode
  function startEdit(item){
    edit(item);
    setStatus({ message: 'Loaded item for editing', type: 'info' });
  }

  async function del(id){
    if (!confirm('Delete this article?')) return;
    setStatus({ message: 'Deleting…', type: 'info' });
    const opts = { method: 'DELETE' };
    if (password) opts.headers = { 'x-cms-password': password };
    try {
  const res = await safeFetch(`/api/articles/${id}`, opts);
      if (!res.ok) {
        const j = await res.json().catch(()=>({ error: 'delete failed' }));
        setStatus({ message: j.error || 'Delete failed', type: 'error' });
      } else {
        setStatus({ message: 'Deleted', type: 'success' });
        await load();
      }
    } catch (e) {
      setStatus({ message: String(e.message || e), type: 'error' });
    }
  }

  // Toggle per-item publish confirmation checkbox
  function togglePublishCheck(id) {
    setPublishChecks(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Publish a single draft item
  async function publishDraft(id) {
    // open modal instead of immediate confirm
    setConfirmPublish({ open: true, id });
  }

  // Validate an item for publishing; returns array of missing field labels
  function validateForPublish(item) {
    const missing = [];
    if (!item.title || !String(item.title).trim()) missing.push('Title');
    if (!item.excerpt || !String(item.excerpt).trim()) missing.push('Excerpt');
    if (!item.category || !String(item.category).trim()) missing.push('Category');
    if (!item.author || !String(item.author).trim()) missing.push('Author');
    if (!item.tags || !Array.isArray(item.tags) || item.tags.length === 0) missing.push('Tags');
    if (!item.coverImage || !String(item.coverImage).trim()) missing.push('Cover photo');
    if (!item.thumbnail || !String(item.thumbnail).trim()) missing.push('Thumbnail');
    const plain = (item.content || '').replace(/<[^>]*>/g, '').trim();
    if (!plain) missing.push('Content');
    return missing;
  }

  // Attempt to publish an item after client-side validation; shows warning if missing fields
  function attemptPublish(item) {
    if (!item) return setStatus({ message: 'Item not found', type: 'error' });
    const missing = validateForPublish(item);
    if (missing.length > 0) {
      const msg = `Cannot publish — missing required fields: ${missing.join(', ')}`;
      // show a clear warning to the user
      try { window.alert(msg); } catch(e) { /* fallback */ }
      setStatus({ message: msg, type: 'error' });
      return;
    }
    // All good — publish immediately
    doPublish(item.id);
  }

  async function doPublish(id) {
    const item = items.find(it => it.id === id);
    if (!item) return setStatus({ message: 'Item not found', type: 'error' });
    setStatus({ message: 'Publishing…', type: 'info' });
    try {
      const payload = { ...item, published: true, slug: item.slug || slugifyTitle(item.title) };
      const opts = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
      if (password) opts.headers['x-cms-password'] = password;
  const res = await safeFetch(`/api/articles/${id}`, opts);
      if (!res.ok) throw new Error((await res.json()).error || 'Publish failed');
      const updated = await res.json();
      updated.published = !!updated.published;
      if (!updated.slug && updated.title) updated.slug = slugifyTitle(updated.title);
      setItems(prev => prev.map(it => it.id === id ? updated : it));
      setPublishChecks(prev => ({ ...prev, [id]: false }));
      setConfirmPublish({ open: false, id: null });
      setStatus({ message: 'Published', type: 'success' });
      pushToast(`Published: ${updated.title}`, 'success', 3000);
    } catch (e) {
      setStatus({ message: String(e.message || e), type: 'error' });
      setConfirmPublish({ open: false, id: null });
      await load();
    }
  }

  // Toggle pin/unpin an article (Editors Pick)
  async function togglePin(id) {
    const it = items.find(x=>x.id===id);
    if (!it) return setStatus({ message: 'Item not found', type: 'error' });
    const newPinned = !it.pinned;
    // optimistic UI update so user sees immediate change
    setItems(prev => prev.map(p => p.id === id ? { ...p, pinned: newPinned, pinnedAt: newPinned ? new Date() : null } : p));
    pushToast(newPinned ? 'Article pinned' : 'Article unpinned', 'success', 2000);
    setStatus({ message: newPinned ? 'Pinning…' : 'Unpinning…', type: 'info' });
    try {
      const payload = { ...it, pinned: newPinned };
      if (newPinned) payload.pinnedAt = new Date(); else payload.pinnedAt = null;
      const opts = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
      if (password) opts.headers['x-cms-password'] = password;
  const res = await safeFetch(`/api/articles/${id}`, opts);
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Pin failed');
      }
      const updated = await res.json();
      setItems(prev => prev.map(itm => itm.id === id ? updated : itm));
      setStatus({ message: newPinned ? 'Pinned' : 'Unpinned', type: 'success' });
    } catch (e) {
      // revert optimistic update on error
      setItems(prev => prev.map(p => p.id === id ? { ...p, pinned: it.pinned, pinnedAt: it.pinnedAt } : p));
      setStatus({ message: String(e.message || e), type: 'error' });
      pushToast('Pin update failed', 'error', 3000);
      await load();
    }
  }

  async function uploadFile(e, target){
    // accept either a submit event from a <form> or a change event from a file <input>
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
    let f;
    if (e && e.target) {
      // input change event (e.target.files)
      if (e.target.files && e.target.files[0]) f = e.target.files[0];
      // form submit event (e.target.elements.file.files)
      else if (e.target.elements && e.target.elements.file && e.target.elements.file.files && e.target.elements.file.files[0]) f = e.target.elements.file.files[0];
    }
    if (!f) { pushToast('No file selected', 'error'); return; }
    // client-side pre-checks: size and type via magic-bytes
    if (f.size > 5 * 1024 * 1024) { pushToast('File too large (max 5MB)', 'error'); return; }
    // read first few bytes for signature detection (do not read full file)
    let sig;
    try {
      const head = await f.slice(0, 12).arrayBuffer();
      sig = new Uint8Array(head);
    } catch (e) {
      pushToast('Unable to read file', 'error');
      return;
    }
    // detect PNG, JPEG, GIF, WEBP
    const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47;
    const isJpeg = sig[0] === 0xFF && sig[1] === 0xD8 && sig[2] === 0xFF;
    const isGif = sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x38;
    const isRiff = sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46;
    // WEBP has 'RIFF' at 0 and 'WEBP' at offset 8
    let isWebp = false;
    try { const off8 = await f.slice(8, 12).arrayBuffer(); const off8u = new Uint8Array(off8); isWebp = off8u[0] === 0x57 && off8u[1] === 0x45 && off8u[2] === 0x42 && off8u[3] === 0x50; } catch(e){}
    if (!(isPng || isJpeg || isGif || (isRiff && isWebp))) {
      pushToast('Only PNG, JPEG, GIF or WEBP files are allowed', 'error');
      return;
    }
    // dimensions check — prefer createImageBitmap for accuracy and performance
    try {
      let width, height;
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(f);
        width = bitmap.width; height = bitmap.height;
        // close bitmap if possible
        try { bitmap.close && bitmap.close(); } catch(e){}
      } else {
        // fallback to Image
        const url = URL.createObjectURL(f);
        const dims = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.width, h: img.height }); };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid image')); };
          img.src = url;
        });
        width = dims.w; height = dims.h;
      }
      if (width > 4096 || height > 4096) { pushToast('Image dimensions too large (max 4096×4096)', 'error'); return; }
    } catch (e) {
      pushToast('Invalid image file', 'error');
      return;
    }
    setStatus({ message: 'Uploading…', type: 'info' });
    // First try multipart/form-data via FormData (streams), falls back to base64 JSON if needed
    try {
  const fd = new FormData();
  fd.append('file', f);
  // include credentials so admin cookie is sent for requireAdmin on server
  const opts = { method: 'POST', body: fd, credentials: 'same-origin' };
      if (password) opts.headers = { 'x-cms-password': password };
  const url = `/api/admin/upload${target ? `?target=${encodeURIComponent(target)}` : ''}`;
  const res = await safeFetch(url, opts);
      if (!res.ok) {
        const j = await res.json().catch(()=>({ error: 'upload failed' }));
        // handle known errors
        if (res.status === 415) { pushToast(j.error || 'Only images are allowed', 'error'); return; }
        if (res.status === 413) { pushToast(j.error || 'File too large (max 5MB)', 'error'); return; }
        if (res.status === 422) { pushToast(j.error || 'Image dimensions too large', 'error'); return; }
        throw new Error(j.error || 'multipart upload failed');
      }
      const j = await res.json();
      pushToast('Upload successful', 'success');
      // handle target-specific behavior
      if (target === 'thumbnail') {
        setForm(prev => ({ ...prev, thumbnail: j.url }));
        setStatus({ message: 'Thumbnail uploaded', type: 'success' });
        // do not open uploadResult modal for thumbnail
        // reset thumbnail input so previous file isn't kept
        try { if (thumbnailInputRef && thumbnailInputRef.current) thumbnailInputRef.current.value = ''; } catch(e){}
        return j;
      }
      if (target === 'cover') {
        setForm(prev => ({ ...prev, coverImage: j.url }));
        setStatus({ message: 'Cover uploaded', type: 'success' });
        // do not open uploadResult modal for cover
        // reset cover input so previous file isn't kept
        try { if (coverInputRef && coverInputRef.current) coverInputRef.current.value = ''; } catch(e){}
        return j;
      }
      // default/insert: show upload result so user can insert or set
      setUploadResult(j);
      setUploadConfirmed(true);
      // reset the insert input so the form no longer retains the file
      try { if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; } catch(e){}
      return j;
  // Do not auto-insert uploaded image into content. User can insert via "Insert image in content" button.
      return;
    } catch (err) {
      // if code reached here it's a generic multipart failure — try base64 fallback only for transport issues
      pushToast('Multipart upload failed, trying fallback…', 'info');
    }

    // Fallback: base64 JSON (browser-safe conversion)
    const arr = await f.arrayBuffer();
    function arrayBufferToBase64(buffer) {
      // chunked conversion to avoid call stack limits for large files
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, sub);
      }
      return btoa(binary);
    }
    const b64 = arrayBufferToBase64(arr);
    const payload = { name: f.name, data: b64 };
    const fallbackOpts = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' };
    if (password) fallbackOpts.headers['x-cms-password'] = password;
  const url = `/api/admin/upload${target ? `?target=${encodeURIComponent(target)}` : ''}`;
  const res = await safeFetch(url, fallbackOpts);
    if (!res.ok) {
      const j = await res.json().catch(()=>({ error: 'upload failed' }));
      return pushToast(j.error || 'upload failed', 'error');
    }
    const j = await res.json();
    pushToast('Upload successful', 'success');
    if (target === 'thumbnail') {
      setForm(prev => ({ ...prev, thumbnail: j.url }));
      setStatus({ message: 'Thumbnail uploaded', type: 'success' });
      try { if (thumbnailInputRef && thumbnailInputRef.current) thumbnailInputRef.current.value = ''; } catch(e){}
      return j;
    }
    if (target === 'cover') {
      setForm(prev => ({ ...prev, coverImage: j.url }));
      setStatus({ message: 'Cover uploaded', type: 'success' });
      try { if (coverInputRef && coverInputRef.current) coverInputRef.current.value = ''; } catch(e){}
      return j;
    }
    setUploadResult(j);
    setUploadConfirmed(true);
    try { if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; } catch(e){}
    return j;
  // Do not auto-insert uploaded image into content. User can insert via the Insert button.
      } catch (err) {
        // Top-level catch to prevent uncaught network errors from bubbling to the runtime
        pushToast(`Upload failed: ${String(err.message || err)}`, 'error');
        console.error('uploadFile error', err);
        return;
      }
  }

  function execCommand(cmd, value) {
    try {
      if (!editor) return;
      // map some simple commands to TipTap commands
      if (cmd === 'bold') editor.chain().focus().toggleBold().run();
      else if (cmd === 'italic') editor.chain().focus().toggleItalic().run();
      else if (cmd === 'createLink') editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
      setForm(prev => ({ ...prev, content: editor.getHTML() }));
      editor && editor.commands.focus();
    } catch (e) {}
  }

  function insertHtmlAtCursor(html) {
    // TipTap handles insertions; fallback to raw HTML append
    if (editor) {
      // simple approach: append HTML at the end
      editor.commands.setContent(editor.getHTML() + html, false);
      setForm(prev => ({ ...prev, content: editor.getHTML() }));
      return;
    }
    const el = contentRef.current;
    if (!el) return;
  // Ensure any <img> in html is constrained
  const constrained = html.replace(/<img\s+/g, '<img style="max-width:720px; max-height:560px; width:auto; height:auto; display:block; margin:8px 0;" ');
  el.innerHTML += constrained;
    setForm(prev => ({ ...prev, content: el.innerHTML }));
  }

  function removeImageNode(domImg) {
    try {
      if (!editor) return;
      // find image node by src attribute
      const src = domImg && domImg.getAttribute && domImg.getAttribute('src');
      if (!src) return;
      // use tiptap to find and remove the node matching src
      // traverse document to find image nodes and remove matching src
      const doc = editor.state.doc;
      let foundPos = null;
      doc.descendants((node, pos) => {
        if (node.type && node.type.name === 'image' && node.attrs && node.attrs.src === src) {
          foundPos = pos;
          return false; // stop
        }
        return true;
      });
      if (foundPos !== null) {
        editor.chain().focus().command(({ tr }) => {
          tr.deleteRange(foundPos, foundPos + 1);
          return true;
        }).run();
        setForm(prev => ({ ...prev, content: editor.getHTML() }));
        setStatus({ message: 'Removed image', type: 'info' });
      }
    } catch (e) { console.error('removeImageNode', e); }
  }

  // Remove image nodes matching a given URL from the editor (if present)
  function removeImageByUrl(url) {
    try {
      if (!url) return;
      if (!editor) {
  // fallback: remove any occurrences in raw html content
  const plain = form.content || '';
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<img[^>]+src=["']${escapeRegex(url)}["'][^>]*>`, 'g');
  const cleaned = plain.replace(re, '');
  setForm(prev => ({ ...prev, content: cleaned }));
        return;
      }
      const doc = editor.state.doc;
      let foundPos = null;
      doc.descendants((node, pos) => {
        if (node.type && node.type.name === 'image' && node.attrs && node.attrs.src === url) {
          foundPos = pos;
          return false;
        }
        return true;
      });
      if (foundPos !== null) {
        editor.chain().focus().command(({ tr }) => {
          tr.deleteRange(foundPos, foundPos + 1);
          return true;
        }).run();
        setForm(prev => ({ ...prev, content: editor.getHTML() }));
        setStatus({ message: 'Removed image from content', type: 'info' });
      }
    } catch (e) { console.error('removeImageByUrl', e); }
  }

  function setUploadedAsCover(){
    if (!uploadResult) return setStatus({ message: 'No upload to set', type: 'error' });
    setForm(prev => ({ ...prev, coverImage: uploadResult.url }));
    setStatus({ message: 'Set uploaded image as cover', type: 'success' });
  // clear upload state and reset inputs
  clearUploadState();
  }

  function clearUploadState(){
    setUploadResult(null);
    setUploadConfirmed(false);
    try { if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; } catch(e){}
    try { if (coverInputRef && coverInputRef.current) coverInputRef.current.value = ''; } catch(e){}
    try { if (thumbnailInputRef && thumbnailInputRef.current) thumbnailInputRef.current.value = ''; } catch(e){}
  }

  // Insert the last uploaded image into the editor/content at cursor
  async function insertUploadedIntoContent(){
    if (!uploadResult) return setStatus({ message: 'No upload to insert', type: 'error' });
    const url = uploadResult.url;
    try {
      // If TipTap editor is available, insert image node with constrained dimensions
      if (editor) {
        // try to preserve aspect ratio within max bounds
        // We can't access the original File here, so insert without explicit width/height
        editor.chain().focus().setImage({ src: url }).run();
        setForm(prev => ({ ...prev, content: editor.getHTML() }));
      } else {
        // fallback: insert HTML at cursor
        const imgHtml = `<img src="${url}" alt="uploaded" style="max-width:720px; max-height:560px; width:auto; height:auto; display:block; margin:8px 0;" />`;
        insertHtmlAtCursor(imgHtml);
      }
      setStatus({ message: 'Inserted image into content', type: 'success' });
  // clear upload state and reset inputs so previous upload details are not retained
  setUploadResult(null);
  setUploadConfirmed(false);
  try { if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; } catch(e){}
  try { if (coverInputRef && coverInputRef.current) coverInputRef.current.value = ''; } catch(e){}
  try { if (thumbnailInputRef && thumbnailInputRef.current) thumbnailInputRef.current.value = ''; } catch(e){}
    } catch (e) {
      setStatus({ message: 'Failed to insert image', type: 'error' });
    }
  }


  // If setup is needed or user is not logged in, show only the auth/setup panel and don't render the admin UI
  const authPanel = setupNeeded ? (
    <div style={{ maxWidth:560, margin:'48px auto', padding:24, border:'1px solid #eee', borderRadius:8 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <img src="/cointist-logo.webp" alt="Cointist" style={{ maxWidth: 320, height: 'auto', display: 'inline-block' }} />
      </div>
      <h2 style={{ textAlign: 'center' }}>Initial setup</h2>
      <p style={{ textAlign: 'center' }}>Create the single admin account (username + password).</p>
      <div style={{ display:'flex', gap:12, marginTop:12, justifyContent: 'center', alignItems: 'center' }}>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className={styles.input} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className={styles.input} />
        <button className={styles.btnPrimary} style={{ marginLeft: 8, padding: '8px 16px' }} onClick={doSetup}>Create</button>
      </div>
      <div style={{ marginTop:12 }}>
        {status.message ? <div className={`${styles.statusBox} ${status.type==='error' ? styles.statusError : status.type==='success' ? styles.statusSuccess : styles.statusInfo}`}>{status.message}</div> : null}
      </div>
    </div>
  ) : (!loggedIn ? (
    <div style={{ maxWidth:560, margin:'48px auto', padding:24, border:'1px solid #eee', borderRadius:8 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <img src="/cointist-logo.webp" alt="Cointist" style={{ maxWidth: 320, height: 'auto', display: 'inline-block' }} />
      </div>
      <h2 style={{ textAlign: 'center' }}>Admin login</h2>
      <div style={{ display:'flex', gap:12, marginTop:12, justifyContent: 'center', alignItems: 'center'}}>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className={styles.input} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className={styles.input} />
  <button className={styles.btnPrimary} style={{ marginLeft: 8, padding: '8px 16px' }} onClick={async ()=>{ try { const res = await safeFetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'same-origin' }); if (!res.ok) { const j = await res.json().catch(()=>({ error: 'login failed' })); setStatus({ message: j.error || 'Login failed', type: 'error' }); } else { setLoggedIn(true); setStatus({ message: 'Logged in', type: 'success' }); } } catch (e) { setStatus({ message: String(e.message || e), type: 'error' }); }}}>Log in</button>
      </div>
      <div style={{ marginTop:12 }}>
        {status.message ? <div className={`${styles.statusBox} ${status.type==='error' ? styles.statusError : status.type==='success' ? styles.statusSuccess : styles.statusInfo}`}>{status.message}</div> : null}
      </div>
    </div>
  ) : null);

  if (authPanel) return <div className={styles.container}>{authPanel}</div>;

  return (
    <div className={styles.container}>
  {/* Autosave restore banner */}
  {autosaveAvailable ? (
    <div style={{ background:'#fff7cc', border:'1px solid #f5d88c', padding:12, marginBottom:12, borderRadius:6, display:'flex', gap:12, alignItems:'center', justifyContent:'space-between' }}>
      <div style={{ fontSize:14 }}>A draft was autosaved locally. You can restore it or clear the saved draft.</div>
      <div style={{ display:'flex', gap:8 }}>
        <button className={styles.btnPrimary} onClick={restoreAutosave}>Restore draft</button>
        <button className={styles.btnSecondary} onClick={clearAutosave}>Clear saved draft</button>
      </div>
    </div>
  ) : null}
  {/* Inline status banner (also syncs toasts) */}
  {status && status.message ? <div style={{ display:'flex', justifyContent:'center', paddingTop:8 }}><div className={`${styles.statusBox} ${status.type==='error' ? styles.statusError : status.type==='success' ? styles.statusSuccess : styles.statusInfo}`}>{status.message}</div></div> : null}
      {/* Header: show logout when logged in */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0' }}>
        {loggedIn ? (
          <button onClick={doLogout} className={styles.btnSecondary} style={{ marginRight: 8 }}>Log out</button>
        ) : null}
      </div>
    
      <div className={styles.twoCol}>
        <div className={styles.leftCol}>
          {/* Search + category filter controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input placeholder="Search title or excerpt (min 3 chars)" value={search} onChange={e=>setSearch(e.target.value)} className={styles.input} />
            <button type="button" onClick={()=>{ setPage(1); load(); }} className={styles.btnPrimary} style={{ marginLeft:8 }}>Search</button>
            <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
              {['All','News','Opinions','Analysis','Guides'].map((cat)=> (
                <button key={cat} type="button" onClick={()=>{ setSectionFilter(cat==='All' ? 'All' : cat); setPage(1); }} className={`${styles.btnSecondary} ${sectionFilter===cat ? styles.btnPrimary : ''}`} style={{ padding: '6px 10px' }}>{cat}</button>
              ))}
            </div>
          </div>
                  <div style={{ marginBottom: 12 }}>
                    <button type="button" onClick={()=>{ setForm(guideTemplate()); setEditingId(null); publishedRef.current = false; setStatus({ message: 'Loaded new Guide template', type: 'info' }); }} className={styles.btnSecondary}>New Guide</button>
                  </div>
          <form onSubmit={save} className={styles.form}>
            <input placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required className={styles.input} />
            <select value={form.category} onChange={e=>{ const cat = e.target.value; setForm({...form, category:cat}); if (cat !== 'News') { setSubCategory(''); setForm(prev=>({ ...prev, subcategory: '', featuredOnly: false })); } // clear author if not present in new category
              const source = (cat === 'News' ? (authorsList.length ? authorsList.map(a=> typeof a === 'string' ? a : (a.name || a.title || '')) : NEWS_AUTHORS) : (authorsList.length ? authorsList.map(a=> typeof a === 'string' ? a : (a.name || a.title || '')) : AUTHORS));
              if (form.author && !source.includes(form.author)) setForm(prev=>({ ...prev, author: '' }));
            }} className={styles.select}>
              <option>News</option>
              <option>Articles</option>
              <option>Opinions</option>
              <option>Guides</option>
              <option>Sponsored</option>
            </select>
            {form.category === 'News' ? (
              <div style={{ display:'flex', gap:8, marginTop:6, alignItems:'center' }}>
                <div className={styles.smallMuted}>News type:</div>
                <label><input type="radio" name="newsType" checked={subCategory==='latest'} onChange={()=>{ setSubCategory('latest'); setForm(prev=>({ ...prev, subcategory: 'latest', featuredOnly: false })); }} /> Latest News</label>
                <label><input type="radio" name="newsType" checked={subCategory==='featured'} onChange={()=>{ setSubCategory('featured'); setForm(prev=>({ ...prev, subcategory: 'featured', featuredOnly: true })); }} /> Featured News</label>
              </div>
            ) : null}
            <textarea placeholder="Excerpt" value={form.excerpt} onChange={e=>setForm({...form, excerpt:e.target.value})} rows={2} className={styles.textarea} />
            <select value={form.author || ''} onChange={e=>setForm({...form, author:e.target.value})} className={styles.select}>
              <option value="">-- Select author --</option>
              {(() => {
                const useList = authorsList && authorsList.length ? authorsList.map(a => (typeof a === 'string' ? a : (a.name || a.title || ''))) : null;
                const source = form.category === 'News' ? (useList || NEWS_AUTHORS) : (useList || AUTHORS);
                return source.map(a => (<option key={a} value={a}>{a}</option>));
              })()}
            </select>
            <div className={styles.tagsInputWrap} onClick={()=>{ /* focus input when container clicked */ try{ const el = document.querySelector('.tagInputField'); el && el.focus(); }catch(e){} }}>
              {/* render existing tags as chips */}
              {(form.tags || []).map((t, i)=> (
                <span key={t + i} className={styles.tagChip}>{t}<button type="button" onClick={()=>{
                  setForm(prev=>({ ...prev, tags: (prev.tags || []).filter(x=>x !== t) }));
                }} aria-label={`Remove ${t}`}>×</button></span>
              ))}
              <input className="tagInputField" placeholder="Add tags" value={tagsInput} onChange={e=>setTagsInput(e.target.value)} onKeyDown={e=>{
                if (e.key === 'Enter' || e.key === ',' || e.key === 'Comma') {
                  e.preventDefault();
                  const parts = (tagsInput || '').split(',').map(s=>s.trim()).filter(Boolean);
                  if (parts.length) {
                    setForm(prev=>{
                      const prevTags = Array.isArray(prev.tags) ? prev.tags : (prev.tags ? [prev.tags] : []);
                      const merged = [...prevTags];
                      parts.forEach(p=>{ if (p && !merged.includes(p)) merged.push(p); });
                      return { ...prev, tags: merged };
                    });
                    setTagsInput('');
                    pushToast('Tags added', 'success', 1200);
                  }
                }
              }} onBlur={e=>{
                // commit any remaining value on blur
                const parts = (tagsInput || '').split(',').map(s=>s.trim()).filter(Boolean);
                if (parts.length) {
                  setForm(prev=>{
                    const prevTags = Array.isArray(prev.tags) ? prev.tags : (prev.tags ? [prev.tags] : []);
                    const merged = [...prevTags];
                    parts.forEach(p=>{ if (p && !merged.includes(p)) merged.push(p); });
                    return { ...prev, tags: merged };
                  });
                  setTagsInput('');
                  pushToast('Tags added', 'success', 1200);
                }
              }} />
            </div>
            <input placeholder="OG Title" value={form.ogTitle || ''} onChange={e=>setForm({...form, ogTitle: e.target.value})} className={styles.input} />
            <input placeholder="OG Description" value={form.ogDescription || ''} onChange={e=>setForm({...form, ogDescription: e.target.value})} className={styles.input} />
            <input placeholder="OG Image URL" value={form.ogImage || ''} onChange={e=>setForm({...form, ogImage: e.target.value})} className={styles.input} />
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label className={styles.smallMuted} style={{ marginRight:6 }}>Schedule publish</label>
              <input type="datetime-local" value={form.scheduledAt ? (new Date(form.scheduledAt)).toISOString().slice(0,16) : ''} onChange={e=>setForm({...form, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null})} className={styles.input} style={{ maxWidth:220 }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div className={styles.toolbar}>
                <button type="button" onClick={()=>{ execCommand('bold'); setStatus({ message: 'Toggled bold', type: 'info' }); }} className={styles.toolbarButton}>Bold</button>
                <button type="button" onClick={()=>{ execCommand('italic'); setStatus({ message: 'Toggled italic', type: 'info' }); }} className={styles.toolbarButton}>Italic</button>
                <button type="button" onClick={()=>{ const url = prompt('Link URL'); if (url) { execCommand('createLink', url); setStatus({ message: 'Link added', type: 'info' }); } }} className={styles.toolbarButton}>Link</button>
                <label className={styles.toolbarButton} style={{ cursor: 'pointer' }}>
                  <input ref={insertInputRef} name="file_insert" type="file" accept="image/*" style={{ display:'none' }} onChange={async (ev)=>{ await uploadFile(ev, 'insert'); /* do NOT auto-insert: show modal so user can Insert or Remove */ }} />
                  Insert image in content
                </label>
                  <button type="button" className={styles.toolbarButton} onClick={async ()=>{
                    // open media modal for inserting into content
                    setMediaModal({ visible: true, loading: true, files: [], target: 'insert' });
                    try {
                      const res = await safeFetch('/api/admin/media', { credentials: 'same-origin' });
                      if (!res.ok) throw new Error('Failed to load media');
                      const js = await res.json();
                      setMediaModal({ visible: true, loading: false, files: js.data || [], target: 'insert' });
                    } catch (e) {
                      setStatus({ message: 'Failed to load media library', type: 'error' });
                      setMediaModal(prev => ({ ...prev, loading: false }));
                    }
                  }}>Choose from library</button>
              </div>

              {/* Content header + editor area */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div className={styles.smallMuted}>Content</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button type="button" onClick={()=>{ setHtmlMode(prev=>!prev); setStatus({ message: htmlMode ? 'Switched to rich editor' : 'Switched to HTML editor', type: 'info' }); }} className={styles.btnSecondary}>{htmlMode ? 'Rich editor' : 'Edit HTML'}</button>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{htmlMode ? 'Editing raw HTML — be careful' : 'Rich text editor (supports pasted HTML)'}</div>
                  </div>
                </div>

                <div className={styles.editorWrapper} ref={editorWrapperRef}
                  onMouseMove={(e)=>{
                    try {
                      const el = e.target;
                      if (el && el.tagName === 'IMG') {
                        const rect = el.getBoundingClientRect();
                        const containerRect = editorWrapperRef.current && editorWrapperRef.current.getBoundingClientRect();
                        setImgOverlay({ visible: true, top: rect.top - (containerRect ? containerRect.top : 0), left: rect.left - (containerRect ? containerRect.left : 0), target: el });
                      } else {
                        // hide overlay when not over an image
                        setImgOverlay(prev => prev.visible ? { ...prev, visible: false } : prev);
                      }
                    } catch(e){}
                  }}
                  onMouseLeave={()=> setImgOverlay(prev => prev.visible ? { ...prev, visible: false } : prev)}
                >
                  {htmlMode ? (
                    <textarea className={styles.htmlTextarea} value={form.content || ''} onChange={e=>{
                      setForm(prev=>({ ...prev, content: e.target.value }));
                      try { if (editor) editor.commands.setContent(e.target.value, false); } catch(e){}
                    }} placeholder="Paste or type HTML here" />
                  ) : (
                    (editor ? <EditorContent editor={editor} /> : <div ref={contentRef} dangerouslySetInnerHTML={{ __html: form.content || '' }} />)
                  )}

                  {imgOverlay.visible && imgOverlay.target ? (
                    <button type="button" onClick={()=>{ removeImageNode(imgOverlay.target); setImgOverlay(prev=>({ ...prev, visible:false, target:null })); }}
                      style={{ position:'absolute', top: imgOverlay.top + 8, left: imgOverlay.left + 8, zIndex: 60, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:12, width:28, height:28, cursor:'pointer' }} title="Remove image">×</button>
                  ) : null}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div className={styles.smallMuted}>Cover image</div>
              <div>
                <button type="button" onClick={()=>{
                  // remove from editor if present, clear cover, and reset upload inputs/state
                  try { removeImageByUrl(form.coverImage); } catch(e){}
                  setForm(prev => ({ ...prev, coverImage: '' }));
                  clearUploadState();
                  setStatus({ message: 'Removed cover image and cleared upload state', type: 'info' });
                }} className={styles.btnSecondary}>Remove Image</button>
              </div>
            </div>
            <div style={{ marginTop:8 }}>
              <div className={styles.smallMuted}>Thumbnail</div>
              {form.thumbnail ? (
                  <div style={{ marginTop:6, position:'relative', display:'inline-block' }}>
                    <img src={form.thumbnail} alt="thumbnail" style={{ width:120, height:80, objectFit:'cover', borderRadius:6 }} />
                    <button type="button" onClick={()=>setForm(prev=>({ ...prev, thumbnail: '' }))} title="Remove thumbnail" style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:12, width:24, height:24, cursor:'pointer' }}>×</button>
                  </div>
              ) : (
                <div style={{ marginTop:6, color:'#666', fontSize:13 }}>No thumbnail set — upload above and click "Set as thumbnail"</div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button type="button" onClick={()=>{ const newPublished = !form.published; setForm(prev => ({ ...prev, published: newPublished })); publishedRef.current = newPublished; setStatus({ message: (newPublished ? 'Marked as published' : 'Marked as draft'), type: 'info' }); }} className={styles.btnSecondary}>{form.published ? 'Publish' : 'Draft'}</button>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button type="submit" className={styles.btnPrimary}>{editingId ? 'Save changes' : 'Create article'}</button>
              <button type="button" onClick={()=>{
                  // populate form with guide template
                  const tmpl = guideTemplate('Untitled Guide');
                  setForm(prev => ({ ...prev, ...tmpl }));
                  setTagsInput((tmpl.tags || []).join(', '));
                  publishedRef.current = !!tmpl.published;
                  setEditingId(null);
                  setStatus({ message: 'Prefilled form with Guide template', type: 'info' });
                  try { console.debug('[admin] applied Guide template', tmpl); } catch(e){}
                  try { pushToast('Guide template loaded into form', 'info', 2500); } catch(e){}
                }} className={styles.btnSecondary} style={{ marginLeft: 8 }}>Create from Guide template</button>
              <label style={{ marginLeft:8, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={!!form.pinned} onChange={e=>setForm(prev=>({ ...prev, pinned: !!e.target.checked }))} /> Pin (Editors Pick)</label>
              <label style={{ marginLeft:8, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={!!form.featuredOnly} onChange={e=>setForm(prev=>({ ...prev, featuredOnly: !!e.target.checked }))} /> Featured only (show only in Featured News)</label>
              <button type="button" onClick={()=>{ setForm({ title:'', category:'News', excerpt:'', content:'', published:false, tags: [], ogTitle: '', ogDescription: '', ogImage: '' }); setTagsInput(''); publishedRef.current = false; setEditingId(null); setStatus({ message: 'Form reset', type: 'info' }); }} className={styles.btnSecondary}>Reset</button>
            </div>
          </form>

          <form onSubmit={(e)=>uploadFile(e,'cover')} className={styles.uploadForm}>
            <label className={styles.uploadLabel}>
              <input ref={coverInputRef} name="file" type="file" accept="image/*" />
              <button type="submit" className={styles.btnSecondary}>Upload Cover Photo</button>
            </label>
            <div className={styles.smallNote}>Upload a cover photo (max 5MB; max 4096×4096)</div>
                {uploadResult ? (
                <div style={{ marginTop: 8 }}>
                  <div>Uploaded: <a href={uploadResult.url} target="_blank" rel="noreferrer">{uploadResult.url}</a></div>
                  <div className={styles.uploadPreview}>
                    <div style={{ position:'relative', display:'inline-block' }}>
                      <img src={uploadResult.url} alt="upload" className={styles.uploadPreviewImg} />
                      <button type="button" onClick={()=>{ setUploadResult(null); setUploadConfirmed(false); if (coverInputRef && coverInputRef.current) coverInputRef.current.value = ''; if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; setStatus({ message: 'Cleared uploaded file', type: 'info' }); }} title="Remove uploaded" style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:12, width:28, height:28, cursor:'pointer' }}>×</button>
                    </div>
                  </div>
                  <div style={{ marginTop:6 }}>
                    <button type="button" onClick={insertUploadedIntoContent} className={styles.btnSecondary}>Insert image in content</button>
                    <button type="button" onClick={()=>{ setForm(prev => ({ ...prev, thumbnail: uploadResult.url })); setStatus({ message: 'Thumbnail set', type: 'success' }); setUploadResult(null); setUploadConfirmed(false); try { if (thumbnailInputRef && thumbnailInputRef.current) thumbnailInputRef.current.value = ''; } catch(e){} try { if (insertInputRef && insertInputRef.current) insertInputRef.current.value = ''; } catch(e){} }} style={{ marginLeft:8 }} className={styles.btnSecondary}>Set as thumbnail</button>
                    <button type="button" onClick={setUploadedAsCover} style={{ marginLeft:8 }} className={styles.btnSecondary}>Set as cover</button>
                  </div>
                  {uploadConfirmed ? (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:13, color:'#064e3b' }}>Upload confirmed.</div>
                    </div>
                  ) : null}
                </div>
            ) : null}
          </form>

          {/* Dedicated thumbnail upload form */}
          <form onSubmit={(e)=>uploadFile(e,'thumbnail')} className={styles.uploadForm} style={{ marginTop:12 }}>
            <label className={styles.uploadLabel}>
              <input ref={thumbnailInputRef} name="file" type="file" accept="image/*" />
              <button type="submit" className={styles.btnSecondary}>Upload thumbnail</button>
            </label>
            <div className={styles.smallNote}>Thumbnail will be resized to fit within 320×180</div>
          </form>

          {/* Upload confirmation modal */}
          {uploadResult && uploadConfirmed ? (
                <div className={styles.modalBackdrop}>
                  <div className={styles.modal}>
                    <div style={{ fontWeight:600, marginBottom:8 }}>Upload successful</div>
                    <div style={{ marginBottom:12 }}>File: <a href={uploadResult.url} target="_blank" rel="noreferrer">{uploadResult.url}</a></div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ position:'relative', display:'inline-block' }}>
                        <img src={uploadResult.url} alt="upload" className={styles.uploadPreviewImg} style={{ maxWidth:360, maxHeight:240, borderRadius:6 }} />
                        <button type="button" onClick={()=>{ clearUploadState(); setStatus({ message: 'Cleared uploaded file', type: 'info' }); }} title="Remove uploaded" style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:12, width:28, height:28, cursor:'pointer' }}>×</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button type="button" className={styles.btnSecondary} onClick={async ()=>{ await insertUploadedIntoContent(); /* insertUploadedIntoContent clears upload state */ }}>Insert into content</button>
                      <button type="button" className={styles.btnSecondary} onClick={()=>{ setForm(prev => ({ ...prev, thumbnail: uploadResult.url })); setStatus({ message: 'Thumbnail set', type: 'success' }); clearUploadState(); }}>Set as thumbnail</button>
                      <button type="button" className={styles.btnSecondary} onClick={()=>{ setUploadedAsCover(); setStatus({ message: 'Set uploaded image as cover', type: 'success' }); }}>Set as cover</button>
                      <button type="button" className={styles.btnPrimary} onClick={()=>{ clearUploadState(); setStatus({ message: 'Closed', type: 'info' }); }}>Close</button>
                    </div>
                  </div>
                </div>
              ) : null}

      {/* Toasts (stacked) */}
      <div className={styles.toastContainer} aria-live="polite">
        <div className={styles.toastList}>
          {toasts.map(t => (
            <div key={t.id} className={`${styles.toastItem} ${t.type==='error' ? styles.toastError : t.type==='success' ? styles.toastSuccess : styles.toastInfo}`}>
              <div className={styles.toastIcon} aria-hidden>{t.type==='success' ? '✔' : t.type==='error' ? '⚠' : 'ℹ'}</div>
              <div className={styles.toastMsg}>{t.message}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Media library modal */}
      {mediaModal && mediaModal.visible ? (
        <div className={styles.modalBackdrop} onClick={(e)=>{ if (e.target === e.currentTarget) setMediaModal(prev=>({...prev, visible:false})); }}>
          <div className={styles.modal} style={{ maxWidth:1820, width:'80%' }} role="dialog" aria-modal="true" onKeyDown={(e)=>{ if (e.key==='Escape') setMediaModal(prev=>({...prev, visible:false})); }} tabIndex={-1}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontWeight:600 }}>Media library</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input placeholder="Search files" value={mediaModal.search || ''} onChange={(e)=> setMediaModal(prev=>({ ...prev, search: e.target.value, page:1 }))} className={styles.input} style={{ maxWidth:240 }} />
                <button type="button" className={styles.btnSecondary} onClick={()=>setMediaModal(prev=>({...prev, visible:false}))}>Close</button>
              </div>
            </div>
            {mediaModal.loading ? <div>Loading…</div> : (
                <div>
                {/* compact grid with pagination (uses CSS module classes) */}
                <div className={styles.mediaGrid}>
                  {(mediaModal.files || []).filter(f=>{
                    const q = (mediaModal.search || '').trim().toLowerCase(); if (!q) return true; return f.name.toLowerCase().includes(q) || (f.url||'').toLowerCase().includes(q);
                  }).slice(((mediaModal.page||1)-1) * (mediaModal.pageSize||24), ((mediaModal.page||1)) * (mediaModal.pageSize||24)).map(f=> (
                    <div key={f.name} className={styles.mediaItem}>
                      <div className={styles.mediaThumbWrap}><img src={f.url} alt={f.name} className={styles.mediaThumb} /></div>
                      <div className={styles.mediaName}>{f.name}</div>
                      <div className={styles.mediaActions}>
                        <button type="button" className={styles.btnSecondary} onClick={()=>{
                          if (!mediaModal || !mediaModal.target) return;
                          if (mediaModal.target === 'cover') { setForm(prev => ({ ...prev, coverImage: f.url })); setStatus({ message: 'Cover set', type: 'success' }); }
                          else if (mediaModal.target === 'thumbnail') { setForm(prev => ({ ...prev, thumbnail: f.url })); setStatus({ message: 'Thumbnail set', type: 'success' }); }
                          else if (mediaModal.target === 'insert') { try { if (editor) { editor.chain().focus().setImage({ src: f.url, alt: f.name || '' }).run(); setForm(prev => ({ ...prev, content: editor.getHTML() })); setStatus({ message: 'Inserted into content', type: 'success' }); } else { const safeAlt = (f.name || '').replace(/\"/g, '&quot;'); insertHtmlAtCursor(`<img src=\"${f.url}\" alt=\"${safeAlt}\" style=\"max-width:720px;max-height:560px;display:block;margin:8px 0;\"/>`); setStatus({ message: 'Inserted into content', type: 'success' }); } } catch(e){ setStatus({ message: 'Failed to insert', type: 'error' }); } }
                          setMediaModal(prev=>({ ...prev, visible:false }));
                        }}>Select</button>
                        <a className={styles.btnSecondary} href={f.url} target="_blank" rel="noreferrer">Open</a>
                      </div>
                    </div>
                  ))}
                </div>
                {/* pagination controls */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{(mediaModal.files || []).length} files</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className={styles.btnSecondary} onClick={()=> setMediaModal(prev=>({ ...prev, page: Math.max(1, (prev.page||1) - 1) }))}>Prev</button>
                    <div style={{ padding:6, minWidth:40, textAlign:'center' }}>{mediaModal.page || 1}</div>
                    <button className={styles.btnSecondary} onClick={()=> setMediaModal(prev=>({ ...prev, page: (prev.page||1) + 1 }))}>Next</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
        </div>

        <div className={styles.rightCol}>
          {/* Cover preview shown above the items list for easier visibility */}
          <div className={styles.coverBox}>
            <div className={styles.smallMuted}>Post cover</div>
            {form.coverImage ? (
              <div style={{ marginTop:8 }}>
                <div style={{ position:'relative', display:'inline-block' }}>
                  <img src={form.coverImage} alt="cover" className={styles.coverImg} />
                  <button type="button" onClick={()=>setForm(prev=>({...prev, coverImage: ''}))} title="Remove cover" style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:12, width:28, height:28, cursor:'pointer' }}>×</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:8 }} className={styles.noCover}>No cover image set</div>
            )}
            <div style={{ marginTop:8, display:'flex', gap:8 }}>
              <button type="button" className={styles.btnSecondary} onClick={async ()=>{
                // open media modal for cover selection
                setMediaModal({ visible: true, loading: true, files: [], target: 'cover' });
                try {
                  const res = await safeFetch('/api/admin/media', { credentials: 'same-origin' });
                  if (!res.ok) throw new Error('Failed to load media');
                  const js = await res.json();
                  setMediaModal({ visible: true, loading: false, files: js.data || [], target: 'cover' });
                } catch (e) {
                  setStatus({ message: 'Failed to load media library', type: 'error' });
                  setMediaModal(prev => ({ ...prev, loading: false }));
                }
              }}>Choose cover from library</button>
              <button type="button" className={styles.btnSecondary} onClick={async ()=>{
                // open media modal for thumbnail selection (prefer Supabase bucket)
                  setMediaModal({ visible: true, loading: true, files: [], target: 'thumbnail', page:1, pageSize:24 });
                try {
                  // list files in the 'images' bucket under the 'thumbnails' prefix
                  const res = await safeFetch('/api/admin/media-supabase?bucket=images&prefix=thumbnails', { credentials: 'same-origin' });
                  if (res.status === 501) {
                    // Supabase not configured, fallback to local uploads
                    const res2 = await safeFetch('/api/admin/media', { credentials: 'same-origin' });
                    if (!res2.ok) throw new Error('Failed to load local media');
                    const js2 = await res2.json();
                    setMediaModal({ visible: true, loading: false, files: js2.data || [], target: 'thumbnail', page:1, pageSize:24 });
                    return;
                  }
                  if (!res.ok) throw new Error('Failed to load media');
                  const js = await res.json();
                  setMediaModal({ visible: true, loading: false, files: js.data || [], target: 'thumbnail', page:1, pageSize:24 });
                } catch (e) {
                  setStatus({ message: 'Failed to load media library', type: 'error' });
                  setMediaModal(prev => ({ ...prev, loading: false }));
                }
              }}>Choose thumbnail from library</button>
            </div>
          </div>

          <section>
            <h3>Existing items</h3>
            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
              <button type="button" onClick={doBackup} className={styles.btnSecondary}>Create DB backup</button>
              <div className={styles.smallMuted}>Backups saved to /backups</div>
            </div>
            <div style={{ marginBottom:12 }}>
              <p className={styles.smallMuted} style={{ margin:0 }}>To reduce clutter, the full list of existing items has moved to a dedicated page.</p>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <a href="/admin/existing-items" className={styles.btnPrimary} style={{ display:'inline-block' }}>Open Existing Items</a>
                <a href="/admin/media" className={styles.btnSecondary} style={{ display:'inline-block' }}>Open Media Library</a>
              </div>
            </div>
          </section>
          {/* raw API response removed from UI to avoid exposing internal debug data */}
        </div>
      </div>
    </div>
  );
}