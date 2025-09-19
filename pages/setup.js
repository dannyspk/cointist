import React, { useEffect, useState } from 'react';

export default function Setup() {
  const [needed, setNeeded] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(()=>{
    fetch('/api/admin/setup').then(r=>r.json()).then(j=>setNeeded(j.setupNeeded)).catch(()=>setNeeded(false));
  },[]);

  async function submit(e){
    e.preventDefault();
    setStatus('Creating…');
    const res = await fetch('/api/admin/setup',{ method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ password }) });
    const j = await res.json().catch(()=>({ error: 'network' }));
    if (!res.ok) return setStatus(j.error || 'failed');
    setStatus('Setup complete — restart the dev server or set CMS_PASSWORD env to use the same password.');
    setNeeded(false);
  }

  if (needed === null) return <div style={{ padding: 20 }}>Checking setup…</div>;
  if (!needed) return <div style={{ padding: 20 }}>Setup not needed or already completed.</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Initial CMS setup</h2>
      <p>Create a password to secure the admin API. This stores a one-time hashed password in <code>.cms.json</code>.</p>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:8, maxWidth:420 }}>
        <input type="password" placeholder="New password (min 6 chars)" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Create password</button>
      </form>
      {status ? <div style={{ marginTop: 12 }}>{status}</div> : null}
    </div>
  );
}
