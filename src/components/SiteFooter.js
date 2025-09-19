import React from 'react';
import SOCIALS from '../data/socials'

export default function SiteFooter() {
  return (
    <>
      {/* Spacer between Sponsored and Footer for natural spacing */}
      <div className="site-spacer" aria-hidden="true" />

      {/* Footer */}
      <footer className="site-footer">
        <div className="foot">
          <div className="footer-main">
            <a href="/" aria-label="Home"><img className="footer-logo" src="/assets/logo.webp" alt="Cointist Logo" /></a>
            <p className="footer-desc">Independent crypto news, sponsored content, guides, and analysis —<br />powered by data, driven by curiosity.</p>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/advertise">Advertise</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="/editorial-policy">Editorial Policy</a>
            <a href="/rss">RSS</a>
            <a href="/newsletter">Newsletter</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
        <div className="footer-socials">
          {SOCIALS.map(s => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener" aria-label={s.aria} className="footer-social-link"><img src={s.img} alt={s.aria} /></a>
          ))}
        </div>
        <div className="footer-copyright">© {new Date().getFullYear()} Cointist. All rights reserved.</div>
      </footer>
    </>
  );
}
