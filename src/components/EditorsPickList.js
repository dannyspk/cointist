import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Image from 'next/image'

export default function EditorsPickList({ excludeIds }){
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(()=>{
    let mounted = true
    async function load(){
      try{
  const qs = new URLSearchParams({ pinned: 'true', page: '1', pageSize: '4', featuredOnly: '0' })
        if (excludeIds && Array.isArray(excludeIds) && excludeIds.length) qs.set('excludeIds', excludeIds.join(','))
        const res = await fetch('/api/articles?' + qs.toString())
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        if (!mounted) return
        let list = Array.isArray(json.data) ? json.data : (json.data || [])
  // allow 'Opinions' to appear in Editors' Picks when requested by the caller
  // ensure at least 6 items: if not enough, fetch broader list without pinned filter
  if (list.length < 6) {
          try{
            const qs2 = new URLSearchParams({ page: '1', pageSize: '18', featuredOnly: '0' })
            if (excludeIds && Array.isArray(excludeIds) && excludeIds.length) qs2.set('excludeIds', excludeIds.join(','))
            const res2 = await fetch('/api/articles?' + qs2.toString())
            if (res2.ok){
              const json2 = await res2.json()
              const more = Array.isArray(json2.data) ? json2.data : (json2.data || [])
              // merge unique items preserving order
              const map = new Map()
              ;[...list, ...more].forEach(it=>{
                const key = it.id || it.slug || it.title || Math.random()
                if (!map.has(key)) map.set(key, it)
              })
              list = Array.from(map.values())
              // filter out excluded ids defensively (string/number tolerant)
              if (excludeIds && Array.isArray(excludeIds) && excludeIds.length) {
                const ex = new Set((excludeIds||[]).map(v=>String(v)))
                list = list.filter(it => !ex.has(String(it && it.id)))
              }
            }
          }catch(e){}
        }
    if (mounted) {
      // sort by createdAt (newest first) before taking top picks
      const pickDate = (it) => {
        if (!it) return 0
        const raw = it.createdAt || it.created_at || it.publishedAt || it.published_at || it.updatedAt || it.updated_at || null
        const d = raw ? new Date(raw).getTime() : 0
        return isNaN(d) ? 0 : d
      }
      list.sort((a,b) => pickDate(b) - pickDate(a))
      setItems(list.slice(0,4))
    }
      }catch(e){ if (mounted) setItems([]) }
      finally{ if (mounted) setLoading(false) }
    }
    load()
    return ()=>{ mounted = false }
  }, [excludeIds])

  const placeholder = '/assets/thumb1.webp'

  const formatDateAndRead = (iso, content, altIso) => {
    try{
      // prefer creation time when available (altIso is expected to be createdAt)
      const raw = altIso || iso
      if (!raw) return ''
      const d = new Date(raw)
      const dateLabel = format(d, 'MMM d')
      return dateLabel
    }catch(e){ return '' }
  }
  const excerptPreview = (text) => {
    if (!text) return ''
    try{
      // split into sentences ending with . ? or ! followed by space or end
      // avoid splitting on decimal points (e.g. 1.2) by requiring the punctuation
      // to be followed by whitespace or end and not be between digits
        const sentences = text.match(/(?:[^.?!]|\d\.|\.(?!\d))+[.?!]+(\s|$)/g)
      if (sentences && sentences.length) {
        return sentences.slice(0,2).join(' ').trim()
      }
      const trimmed = text.trim()
      return trimmed.length > 160 ? (trimmed.slice(0,157) + '…') : trimmed
    }catch(e){
      const t = String(text || '')
      return t.length > 160 ? (t.slice(0,157) + '…') : t
    }
  }

  const stripHtml = (html) => {
    if (!html) return ''
    try{
      return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').trim()
    }catch(e){ return String(html || '') }
  }

  // Use a distinct wrapper (.editors-pick-list) so this main-page list
  // does not share layout or styles with the sidebar LatestNews component.
  if (loading && !items) {
    // render 4 placeholders
    return (
      <div className="editors-pick-list">
        {[0,1,2,3].map(i=> (
            <a key={i} className="news-item" href="#" aria-hidden>
              <div className="thumb"><div style={{width:'100%',height:'100%',background:'#0b0d0e'}} /></div>
              <div>
                <span className="kicker">News</span>
                <h4>Loading…</h4>
                <p className="meta">—</p>
                <p>Loading…</p>
              </div>
            </a>
        ))}
      </div>
    )
  }

  if (!Array.isArray(items) || items.length === 0){
    // show placeholders while loading; render nothing if DB returned empty list
    if (loading && !items) {
      return (
        <div className="editors-pick-list">
          {[0,1,2,3].map(i=> (
              <a key={i} className="news-item" href="#" aria-hidden>
                <div className="thumb"><div style={{width:'100%',height:'100%',background:'#0b0d0e'}} /></div>
                <div>
                  <span className="kicker">News</span>
                  <h4 style={{height:18,width:180,background:'#111',borderRadius:4}}></h4>
                  <p className="meta">—</p>
                  <p style={{height:36,background:'#0f0f0f',borderRadius:4}}></p>
                </div>
              </a>
          ))}
        </div>
      )
    }
    return null
  }

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

  return (
    <div className="editors-pick-list">
      {items.map(it=>{
  // use thumbnail only for news-item thumbs (avoid using coverImage)
  const img = normalizeSrc(it.coverImage || it.thumbnail || placeholder)
        const href = it.slug ? (`/articles/${it.slug}`) : '#'
  // Prefer the first tag from the DB as the kicker, fall back to subcategory, category, then 'News'
  let kickerRaw = (Array.isArray(it.tags) && it.tags.length) ? it.tags[0] : (it.subcategory || it.category || 'News')
  let kicker = String(kickerRaw || 'News')
  // Normalize capitalization: Title case-ish (first letter upper, rest lower)
  try{ kicker = kicker.charAt(0).toUpperCase() + kicker.slice(1).toLowerCase() }catch(e){}
        const byline = it.author || 'Cointist'
  const when = formatDateAndRead(it.publishedAt, it.content, it.createdAt || it.created_at)
  // first tag (capitalized) to display next to time; fallback to category
  let firstTag = ''
  if (Array.isArray(it.tags) && it.tags.length) firstTag = String(it.tags[0])
  else if (it.category) firstTag = String(it.category)
  if (firstTag) firstTag = firstTag.charAt(0).toUpperCase() + firstTag.slice(1).toLowerCase()
        return (
          <a key={it.id || it.slug || it.title} className="news-item" href={href}>
            <div className="thumb" style={{height:220, maxWidth:'100%', overflow:'hidden', borderRadius:12}}>
              {/* use Next/Image so the loader selects appropriate sizes (avoid serving 1024px when 405px is enough) */}
                <Image src={img} alt={it.thumbnailAlt || it.title || ''} width={405} height={220} style={{objectFit:'contain', width:'100%', height:'100%'}} sizes="(max-width:600px) 90vw, 405px" />
            </div>
            <div>
              
              <h4>{it.title}</h4>
              <p className="meta">{byline}{when ? ` • ${when}` : ''}{firstTag ? <span> • <strong>{firstTag}</strong></span> : ''}</p>
              <p style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{excerptPreview(it.excerpt || stripHtml(it.content))}</p>
            </div>
          </a>
        )
      })}
    </div>
  )
}
