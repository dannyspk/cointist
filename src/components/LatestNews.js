import React, { useEffect, useState } from 'react'
import styles from '../../styles/article-published.module.css'
import Image from 'next/image'

export default function LatestNews({ article }){
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let mounted = true
    async function load(){
      try{
  // primary query: latest news
  // request unpinned latest news, limit larger for merging then cap to 4 below
  const qs = new URLSearchParams({ category: 'News', subcategory: 'latest', pinned: 'false', featuredOnly: '0', page: '1', pageSize: '10' })
        const url = '/api/articles?' + qs.toString()
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load')
        const json = await res.json()
        if (!mounted) return

        const excludeKey = (it) => {
          try{
            if (!article) return false
            return (article.id && it.id && String(it.id) === String(article.id)) ||
                   (article.slug && it.slug && String(it.slug) === String(article.slug)) ||
                   (article.title && it.title && String(it.title) === String(article.title))
          }catch(e){ return false }
        }

  const primary = Array.isArray(json.data) ? json.data : (json.data || [])
  // Defensive: only keep published articles for the Latest News widget
  const primaryPublished = primary.filter(it => it && (it.published === true || String(it.published) === 'true'))
  let filtered = primaryPublished.filter(it => !excludeKey(it))

  // If we don't have at least 6 items, fetch a broader list (no subcategory) and merge unique items
  if (filtered.length < 6) {
          try{
      // ensure fallback also requests unpinned items
  const qs2 = new URLSearchParams({ category: 'News', page: '1', pageSize: '20', pinned: 'false', featuredOnly: '0' })
            const url2 = '/api/articles?' + qs2.toString()
            const res2 = await fetch(url2)
            if (res2.ok){
              const json2 = await res2.json()
              const more = Array.isArray(json2.data) ? json2.data : (json2.data || [])
              // Only include published fallback items as well
              const morePublished = more.filter(it => it && (it.published === true || String(it.published) === 'true'))
              const map = new Map()
              ;[...filtered, ...morePublished].forEach(it=>{
                if (excludeKey(it)) return
                const key = it.id || it.slug || it.title || Math.random()
                if (!map.has(key)) map.set(key, it)
              })
              filtered = Array.from(map.values())
            }
          }catch(e){ /* ignore fallback errors */ }
        }
  // Cap results to maximum of 6 unpinned items
  // Ensure items are in chronological order (newest first)
  const pickDate = (it) => {
    if (!it) return 0
    // prefer creation time first
    const dateStr = it.createdAt || it.created_at || it.publishedAt || it.published_at || it.updatedAt || it.updated_at || null
    const d = dateStr ? new Date(dateStr).getTime() : 0
    return isNaN(d) ? 0 : d
  }

  filtered.sort((a,b) => pickDate(b) - pickDate(a))
  const final = filtered.slice(0, 6)
  if (mounted) setItems(final)
      }catch(e){
        console.debug && console.debug('LatestNews load error', e)
        if (mounted) setItems([])
      }finally{
        if (mounted) setLoading(false)
      }
    }
    load()
    return ()=>{ mounted = false }
  }, [article])

  const placeholder = '/assets/thumb1.webp'

  const normalizeSrc = (s) => {
    if (!s) return s
    try{
      let raw = String(s).trim()
      if (raw.indexOf(',') !== -1) raw = raw.split(',')[0]
      raw = raw.split(/\s+/)[0]
      raw = raw.replace(/^['"]|['"]$/g, '')
      if (/^https?:\/\//i.test(raw)) return raw
      return raw.startsWith('/') ? raw : `/${raw}`
    }catch(e){ return s }
  }

  const getLabel = (it)=>{
    if (!it) return 'NEWS'
  // Prefer tags[0] first, then subcategory, then category/kicker
  if (Array.isArray(it.tags) && it.tags.length) return String(it.tags[0]).toUpperCase()
  if (it.subcategory) return String(it.subcategory).toUpperCase()
    if (it.category && it.category !== 'News') return String(it.category).toUpperCase()
    if (it.kicker) return String(it.kicker).toUpperCase()
    return 'NEWS'
  }

  return (
    <section className={styles.latestSection} aria-label="Latest news">
      <div className={styles.latestInner}>
        <div className={styles.latestHeader}>Related News</div>
        <div className={styles.latestGrid}>
          {loading && !items ? (
            [0,1,2,3,4,5].map(i=> (
              <article key={i} className={styles.latestCard} aria-hidden>
                <div className={styles.latestThumb} style={{width:88,height:88,background:'#0b0d0e',borderRadius:10}} />
                <div>
                  <div className={styles.latestTitle}>Loading…</div>
                </div>
              </article>
            ))
          ) : null}

          {Array.isArray(items) && items.map((it)=>{
            const img = it.thumbnail || it.coverImage || placeholder
            const href = it.slug ? (`/articles/${it.slug}`) : '#'
            const author = it.author || 'Cointist'
            const dateSrc = it.createdAt || it.created_at || it.publishedAt || it.published_at || it.updatedAt || it.updated_at || null
            const date = dateSrc ? (new Date(dateSrc)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
            return (
              <article key={it.id || it.slug || it.title} className={styles.latestCard}>
                <a className={styles.latestThumb} href={href}>
                      <Image src={normalizeSrc(img)} alt={it.thumbnailAlt || it.title || ''} className={styles.latestThumbImg} width={88} height={88} style={{borderRadius:10}} />
                    </a>
                <div>
                  <div className={styles.latestTitle}><a href={href} className={styles.latestLink}>{it.title}</a></div>
                  <div className={styles.latestByline}>
                    <span className={styles.bylineAuthor}>{author}</span>
                    {date ? <span className={styles.bylineDate}>· {date}</span> : null}
                  </div>
                </div>
              </article>
            )
          })}

        </div>
      </div>
    </section>
  )
}
