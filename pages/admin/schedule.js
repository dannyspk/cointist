import React, { useEffect, useState } from 'react';
import styles from '../../styles/admin.module.css';

export default function AdminSchedule(){
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(()=>{ fetch('/api/admin/schedule', { credentials: 'same-origin' }).then(r=>r.json()).then(j=>{ setItems(j.data || []); setLoading(false); }).catch(()=>setLoading(false)); },[]);

  async function updateSchedule(id, val){
    setSaving(prev=>({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/admin/schedule', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, scheduledAt: val }), credentials: 'same-origin' });
      const j = await res.json();
      // refresh list
      const fresh = await fetch('/api/admin/schedule', { credentials: 'same-origin' }).then(r=>r.json());
      setItems(fresh.data || []);
    } catch(e) {
      // ignore
    } finally { setSaving(prev=>({ ...prev, [id]: false })); }
  }

  if (loading) return <div className={styles.container}><h2>Schedule</h2><div>Loading…</div></div>;
  return (
    <div className={styles.container}>
      <h2>Scheduling</h2>
      <p>Manage scheduled articles — set publish times or clear scheduling.</p>
      <table className={styles.table} style={{ width:'100%' }}>
        <thead><tr><th>ID</th><th>Title</th><th>Scheduled At</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(it=> (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td style={{ maxWidth:320 }}>{it.title}</td>
              <td>
                <input type="datetime-local" value={it.scheduledAt ? (new Date(it.scheduledAt)).toISOString().slice(0,16) : ''} onChange={e=>{
                  const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                  setItems(prev => prev.map(p => p.id === it.id ? { ...p, scheduledAt: v } : p));
                }} />
              </td>
              <td>
                <button className={styles.btnPrimary} onClick={()=>updateSchedule(it.id, it.scheduledAt)} disabled={!!saving[it.id]}>Save</button>
                <button className={styles.btnSecondary} onClick={()=>updateSchedule(it.id, null)} style={{ marginLeft:8 }} disabled={!!saving[it.id]}>Clear</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
