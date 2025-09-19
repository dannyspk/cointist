import React, { useEffect, useState } from 'react'
import styles from '../../styles/admin.module.css'

export default function MediaPage(){
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(){
    setLoading(true); setError(null)
    try{
      const res = await fetch('/api/admin/media', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(await res.text())
      const js = await res.json()
      setFiles(js.data || [])
    }catch(e){ setError(String(e)) }
    setLoading(false)
  }

  useEffect(()=>{ load() }, [])

  async function del(name){
    if (!confirm('Delete file?')) return
    try{
      const res = await fetch('/api/admin/media?name=' + encodeURIComponent(name), { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) throw new Error(await res.text())
      load()
    }catch(e){ alert('Delete failed: ' + String(e)) }
  }

  return (
    <div className={styles.container} style={{ padding:24 }}>
      <h2>Media library</h2>
      {loading ? <div>Loading…</div> : error ? <div style={{ color:'crimson' }}>{error}</div> : (
        <div>
          <div style={{ marginBottom:12 }}><em>Files in /public/uploads</em></div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr><th style={{ textAlign:'left' }}>Preview</th><th>Name</th><th>Size</th><th>Modified</th><th>Actions</th></tr></thead>
            <tbody>
              {files.map(f=> (
                <tr key={f.name} style={{ borderTop:'1px solid #eee' }}>
                  <td style={{ padding:8, width:140 }}>
                    <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} style={{ maxWidth:120, maxHeight:80, objectFit:'cover' }} /></a>
                  </td>
                  <td style={{ padding:8 }}>{f.name}</td>
                  <td style={{ padding:8 }}>{(f.size/1024).toFixed(1)} KB</td>
                  <td style={{ padding:8 }}>{new Date(f.mtime).toLocaleString()}</td>
                  <td style={{ padding:8 }}><button className={styles.btnDanger} onClick={()=>del(f.name)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
