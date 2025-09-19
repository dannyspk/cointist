import React, { useState, useEffect, useRef } from 'react';
import SOCIALS from '../data/socials'

export default function HeaderFromHtml() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    // lock body scroll + inline overflow when menu open (matches original scripts)
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onOverlayClick(e) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="nav">
          <div className="brand">
            <a href="/" aria-label="Home">
              <img className="logo" src="/assets/logo.webp" alt="Cointist" />
            </a>
          </div>

          <ul className="navlinks">
            <li><a href="/">Home</a></li>
            <li><a href="/news">News</a></li>
            <li><a href="/reviews">Reviews</a></li>
            <li><a href="/guides">Guides</a></li>
            <li><a href="/analysis">Analysis</a></li>
            <li><a href="/opinion">Opinion</a></li>
          </ul>

          <div className="right">
            <button className="subscribe-btn">Subscribe</button>
          </div>

          <button
            className="hamburger mobile-menu-hamburger"
            id="mobileMenuOpen"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display: 'block'}}>
              <rect y="7" width="32" height="4" rx="2" fill="#2ce561" />
              <rect y="14" width="32" height="4" rx="2" fill="#2ce561" />
              <rect y="21" width="32" height="4" rx="2" fill="#2ce561" />
            </svg>
          </button>
        </div>
      </header>

      <nav
        id="mobile-menu"
        className={`mobile-menu ${open ? 'is-open mobile-menu-overlay active' : ''}`}
        aria-hidden={!open}
        onClick={onOverlayClick}
      >
        <div className="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Main Menu" ref={panelRef}>
          <button
            id="mobileMenuClose"
            className="mobile-menu__close"
            data-menu-close
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>

          <ul className="mobile-menu__links">
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>

          <div className="mobile-menu__socials">
            <a href="/rss.xml" aria-label="RSS"><img src="/assets/telegram.webp" alt="RSS" /></a>
            {SOCIALS.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.aria}><img src={s.img} alt={s.aria} /></a>
            ))}
          </div>

          <div className="mobile-menu__cta">
            <button className="subscribe-btn" style={{marginTop: 18, textAlign: 'center'}}>Subscribe</button>
          </div>
        </div>
      </nav>
    </>
  );
}
