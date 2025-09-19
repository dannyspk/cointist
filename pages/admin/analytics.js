import React, { useEffect, useState } from 'react';
import styles from '../../styles/admin.module.css';

export default function AdminAnalytics(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    fetch('/api/admin/analytics', { credentials: 'same-origin' }).then(r=>r.json()).then(j=>{ setData(j); setLoading(false); }).catch(e=>{ setError(String(e)); setLoading(false); });
  },[]);

  if (loading) return <div className={styles.container}><h2>Analytics</h2><div>Loading…</div></div>;
  if (error) return <div className={styles.container}><h2>Analytics</h2><div>Error: {error}</div></div>;

  return (
    <div className={styles.container}>
      <h2>Admin Analytics</h2>
      <div style={{ marginBottom:12 }}>Total views tracked: {data.totalViews}</div>
      <section style={{ marginBottom:16 }}>
        <h3>Views (last 7 days)</h3>
        <div style={{ display:'flex', gap:8 }}>
          {data.series.map(s => (
            <div key={s.day} style={{ padding:8, background:'#f3f4f6', borderRadius:6, textAlign:'center', minWidth:64 }}>
              <div style={{ fontSize:18, fontWeight:600 }}>{s.views}</div>
              <div style={{ fontSize:11 }}>{s.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Top items</h3>
        <table className={styles.table} style={{ width:'100%' }}>
          <thead><tr><th>Rank</th><th>Key</th><th>Views</th></tr></thead>
          <tbody>
            {data.top.map((t,i) => (
              <tr key={t.key}><td>{i+1}</td><td style={{ fontFamily:'monospace' }}>{t.key}</td><td>{t.views}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
