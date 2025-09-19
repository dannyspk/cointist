import React from 'react'

export default function SubscribeModal({ open, email, onClose }){
  if (!open) return null
  return (
    <div className="subscribe-modal-overlay" onClick={onClose}>
      <div className="subscribe-modal" role="dialog" aria-modal="true" aria-labelledby="subscribe-modal-title" onClick={(e)=>e.stopPropagation()}>
        <button className="subscribe-modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3 id="subscribe-modal-title">You're in — welcome to Cointist</h3>
        <p>Thanks for subscribing with <strong>{email}</strong>. We'll send a confirmation to this address shortly.</p>
        <div style={{ marginTop: 18 }}>
          <a className="btn btn-gradient" href="/newsletter">Manage preferences</a>
        </div>
      </div>
      <style jsx>{`
        .subscribe-modal-overlay{ position: fixed; inset: 0; background: rgba(3,6,9,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; }
        .subscribe-modal{ background: #0d0f10c5; color: #f6fff9; max-width:520px; width:94%; border-radius:12px; padding:24px; box-shadow: 0 8px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.04); }
        .subscribe-modal h3{ margin:0 0 8px 0; font-size:20px; color: var(--gold, #ffd600); }
        .subscribe-modal p{ margin:0; opacity:0.95; color:#fff; font-size:15px; line-height:1.4; letter-spacing: -0.6px; }
        .subscribe-modal-close{ position:absolute; right:18px; top:12px; background:transparent; border:0; color:#fff; font-size:22px; cursor:pointer }
        .btn.btn-gradient{ display:inline-block; padding:10px 16px; border-radius:8px; color:#071012; background: linear-gradient(90deg,#ffd600,#14f195); text-decoration:none; font-weight:700 }
        @media (max-width:520px){ .subscribe-modal{ padding:18px } }
      `}</style>
    </div>
  )
}
