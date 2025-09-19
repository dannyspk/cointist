import React, { useState, useEffect, useRef } from 'react';
import prisma from '../../../src/lib/prisma';
import db from '../../../src/lib/db';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SEO from '../../../src/components/SEO'
// Topbar is rendered globally in _app.js
import MarketMarquee from '../../../src/components/MarketMarquee';
import SiteFooter from '../../../src/components/SiteFooter';
import ArticleLayout from '../../../src/components/ArticleLayout';
import AUTHORS_META from '../../../src/data/authors';
import GuideLayout from '../../../components/GuideLayout'

export async function getServerSideProps(context) {
  const { slug, category } = context.params || {};
  if (!slug) return { notFound: true };
  const art = await db.findArticleBySlug(slug);
  if (!art) return { notFound: true };
  // optional: if category param doesn't match stored category, redirect to canonical
  if (category && art.category && category.toLowerCase() !== String(art.category).toLowerCase()) {
    return {
      redirect: {
        destination: `/${encodeURIComponent(String(art.category).toLowerCase())}/articles/${encodeURIComponent(art.slug)}`,
        permanent: true
      }
    }
  }
  return { props: { article: JSON.parse(JSON.stringify(art)) } };
}

export default function ArticleCategoryPage({ article }) {
  if (!article) return <div>Not found</div>;
  // Admin inline editor state
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: article.title || '', excerpt: article.excerpt || '', content: article.content || '', author: article.author || '' });
  const [tags, setTags] = useState(Array.isArray(article.tags) ? article.tags : (article.tags ? [article.tags] : []));
  const [tagInput, setTagInput] = useState('');
  const [authorsList, setAuthorsList] = useState([]);
  const router = useRouter();
  // we intentionally use a plain HTML textarea for content editing on the article page

  useEffect(()=>{
    // check admin status via existing endpoint; use credentials so cookie-based auth works
    let cancelled = false;
    (async ()=>{
      try {
        const r = await fetch('/api/admin/me', { credentials: 'same-origin' });
        if (!cancelled) setIsAdmin(!!r.ok);
      } catch (e) {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return ()=>{ cancelled = true };
  }, []);

  // fetch authors for dropdown (match legacy editor)
  useEffect(()=>{
    let mounted = true;
    fetch('/api/authors').then(r=>r.json()).then(j=>{ if (!mounted) return; setAuthorsList(Array.isArray(j)?j:[]) }).catch(()=>{ if (mounted) setAuthorsList([]) })
    return ()=>{ mounted = false }
  },[])

  function openEditor() {
    setForm({ title: article.title || '', excerpt: article.excerpt || '', content: article.content || '', author: article.author || '' });
    setTags(Array.isArray(article.tags) ? article.tags : (article.tags ? [article.tags] : []));
    setTagInput('');
    setEditMode(true);
  }
 async function publishArticle(e) {
    e && e.preventDefault && e.preventDefault();
    try {
  const payload = { title: form.title, excerpt: form.excerpt, content: form.content, author: form.author, category: form.category || article.category };
      payload.tags = Array.isArray(tags) ? tags.slice() : [];
  // include cover/thumbnail from form if present, otherwise fall back to existing article values
  payload.coverImage = form.coverImage || article.coverImage;
  payload.thumbnail = form.thumbnail || article.thumbnail;
      payload.published = true;
      const res = await fetch(`/api/articles/${encodeURIComponent(String(article.id || article.id))}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      const js = await res.json().catch(()=>null);
      if (!res.ok) {
        throw new Error((js && js.error) ? js.error : 'Publish failed');
      }
      // clear, explicit feedback to user so they know publish succeeded or not
      if (js && js.published) {
        try { alert('Published successfully'); } catch (e) {}
      } else {
        try { alert('Publish request succeeded but server did not mark item published'); } catch (e) {}
      }
      setEditMode(false);
      try { window.location.reload(); } catch (e) { router.reload(); }
    } catch (err) {
      try { alert('Publish failed: ' + String(err.message || err)); } catch(e){}
    }
  }
  async function saveEdit(e) {
    e && e.preventDefault && e.preventDefault();
    try {
      const payload = { title: form.title, excerpt: form.excerpt, content: form.content, author: form.author };
      // include tags array from local state
      payload.tags = Array.isArray(tags) ? tags.slice() : [];
      const res = await fetch(`/api/articles/${encodeURIComponent(String(article.id || article.id))}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      if (!res.ok) {
        const js = await res.json().catch(()=>({ error: 'update failed' }));
        throw new Error(js.error || 'Update failed');
      }
      // reload to reflect canonical server-side changes (slug/publishedAt etc.)
      setEditMode(false);
      try { window.location.reload(); } catch (e) { router.reload(); }
    } catch (err) {
      try { alert('Save failed: ' + String(err.message || err)); } catch(e){}
    }
  }
  const isGuide = String(article.category || '').toLowerCase() === 'guides';
  {isGuide ? (
    // Guides: render guide shell (hero, meta, author box) and then the guide content
    (() => {
      // estimate reading time from plain-text
      const plain = String(article.content || '').replace(/<[^>]+>/g, ' ');
      const words = plain.trim().split(/\s+/).filter(Boolean).length || 0;
      const readingTime = Math.max(1, Math.round(words / 200));
      const rawPublished = article.publishedAt || article.published_at || null;
      const publishedDate = rawPublished ? new Date(rawPublished) : null;
      const publishedLabel = publishedDate ? publishedDate.toLocaleDateString() : '';
      const authorMeta = (AUTHORS_META && AUTHORS_META[article.author]) || null;
  const authorThumb = article.authorImage || article.authorAvatar || (authorMeta ? `/authors/orig/${authorMeta.file}` : '/assets/author-avatar.webp');

      return (
        <GuideLayout>
          <section className="hero">
            <div className="hero-inner">
              <div className="hero-left">
                <div className="crumbs"><a href="/guides">Guides</a></div>
                <h1>{article.title}</h1>
              </div>
              <div className="meta">
                <span className="kpi">{article.level || 'Beginner'}</span>
                <span className="kpi">{readingTime} min read</span>
                <span className="kpi">Last updated: {publishedLabel}</span>
              </div>
            </div>
          </section>

          <main className="wrap">
            <div className="grid">
              <div>
                {/* article body */}
                <article dangerouslySetInnerHTML={{ __html: article.content || '' }} />

                {/* author box below content */}
                {article.author ? (
                  <aside className="related" style={{ marginTop: 20 }}>
                    <h3>About the author</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <img src={authorThumb} alt={article.author} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{article.author}</div>
                        <div style={{ color: '#c9d6d2' }}>{article.authorTitle || (authorMeta ? authorMeta.lead : '')}</div>
                      </div>
                    </div>
                  </aside>
                ) : null}

              </div>

              <aside className="toc">
                <h4>On this page</h4>
                <ol>
                  {/* simple TOC generation from content headings could be added here */}
                </ol>
              </aside>
            </div>
          </main>
        </GuideLayout>
      );
    })()
  ) : (
    <ArticleLayout article={article} />
  )}
  return (
    <>
      <SEO
        title={article.ogTitle || article.title}
        description={article.ogDescription || article.excerpt}
        image={article.ogImage || article.coverImage}
        canonical={article.slug ? (process.env.SITE_URL || 'https://cointist.net') + `/${encodeURIComponent(String(article.category || 'articles').toLowerCase())}/articles/${encodeURIComponent(article.slug)}` : undefined}
        url={article.slug ? `/${encodeURIComponent(String(article.category || 'articles').toLowerCase())}/articles/${encodeURIComponent(article.slug)}` : undefined}
        author={article.author || article.authorName || article.author_name}
        datePublished={article.publishedAt || article.published_at || article.published || article.createdAt}
        dateModified={article.updatedAt || article.updated_at || article.modifiedAt || article.dateModified}
      />
<MarketMarquee />
      

      {/* Admin edit button (floating) */}
      {isAdmin ? (
        <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 1200 }}>
          {!editMode ? (
            <button onClick={()=>{ setForm({ title: article.title || '', excerpt: article.excerpt || '', content: article.content || '', author: article.author || '' }); setTags(Array.isArray(article.tags) ? article.tags : (article.tags ? [article.tags] : [])); setTagInput(''); setEditMode(true); }} style={{ background: '#0070f3', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Edit</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {/* show Publish when all required publish fields are present */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {(function(){
                        const haveTitle = form.title && String(form.title).trim();
                        const haveExcerpt = form.excerpt && String(form.excerpt).trim();
                        const haveAuthor = form.author && String(form.author).trim();
                        const haveCategory = (form.category || article.category) && String(form.category || article.category).trim();
                        const haveTags = Array.isArray(tags) && tags.length > 0;
                        const haveCover = (form.coverImage && String(form.coverImage).trim()) || (article.coverImage && String(article.coverImage).trim());
                        const haveThumb = (form.thumbnail && String(form.thumbnail).trim()) || (article.thumbnail && String(article.thumbnail).trim());
                        return (haveTitle && haveExcerpt && haveAuthor && haveCategory && haveTags && haveCover && haveThumb) ? (
                          <button onClick={publishArticle} style={{ background: '#d9534f', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Publish</button>
                        ) : null;
                      })()}
                      <button onClick={saveEdit} style={{ background: '#0a9', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => { setEditMode(false); setForm({}); setTags(Array.isArray(article.tags) ? article.tags : (article.tags ? [article.tags] : [])); setTagInput(''); }} style={{ background: '#ccc', color: '#000', padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Inline editor modal */}
      {editMode ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={saveEdit} style={{ width: '90%', maxWidth: 1100, maxHeight: '90%', overflow: 'auto', background: '#fff', padding: 20, borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input value={form.title} onChange={e=>setForm(prev=>({ ...prev, title: e.target.value }))} placeholder="Title" style={{ flex: 1, padding: 8 }} />
              <select value={form.author || ''} onChange={e=>setForm(prev=>({ ...prev, author: e.target.value }))} style={{ width: 240, padding: 8 }}>
                <option value="">-- choose author --</option>
                {authorsList.map(a=> (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', marginBottom: 6 }}><strong>Tags</strong></label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid #ddd', padding: 8, borderRadius: 6 }} onClick={()=>{ /* focus input if container clicked */ }}>
                    {tags.map((t, idx) => (
                      <div key={t + idx} style={{ display: 'inline-flex', alignItems: 'center', background: '#eef6f2', padding: '4px 8px', borderRadius: 16, marginRight: 6, marginBottom: 6 }}>
                        <span style={{ marginRight: 8, color: '#333' }}>{t}</span>
                        <button type="button" onClick={() => setTags(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const parts = tagInput.split(',').map(s=>s.trim()).filter(Boolean);
                          if (parts.length) {
                            setTags(prev => {
                              const next = prev ? prev.slice() : [];
                              parts.forEach(p=>{ if (p && !next.includes(p)) next.push(p) })
                              return next;
                            });
                            setTagInput('');
                          }
                        }
                        if (e.key === 'Backspace' && !tagInput) {
                          // remove last tag when backspace in empty input
                          setTags(prev => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => {
                        const parts = String(tagInput || '').split(',').map(s=>s.trim()).filter(Boolean);
                        if (parts.length) {
                          setTags(prev => {
                            const next = prev ? prev.slice() : [];
                            parts.forEach(p=>{ if (p && !next.includes(p)) next.push(p) })
                            return next;
                          });
                          setTagInput('');
                        }
                      }}
                      placeholder="Type a tag and press Enter or comma"
                      style={{ flex: 1, minWidth: 160, border: 'none', outline: 'none', padding: 4 }}
                    />
                  </div>
                </div>
                <textarea value={form.excerpt} onChange={e=>setForm(prev=>({ ...prev, excerpt: e.target.value }))} placeholder="Excerpt" rows={3} style={{ width: '100%', padding: 8 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6 }}><strong>Content (raw HTML)</strong></label>
              <textarea value={form.content} onChange={e=>setForm(prev=>({ ...prev, content: e.target.value }))} placeholder="Content (HTML)" rows={18} style={{ width: '100%', padding: 8, fontFamily: 'monospace', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={()=>setEditMode(false)} style={{ padding: '8px 12px' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 12px', background: '#0a9', color: '#fff', border: 'none', borderRadius: 6 }}>Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {isGuide ? (
        <GuideLayout article={article} />
      ) : (
        <ArticleLayout article={article} />
      )}

      <SiteFooter />
    </>
  );
}
