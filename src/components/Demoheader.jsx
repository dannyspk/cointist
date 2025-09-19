import React, { useState, useEffect, useRef } from 'react';
import styles from './demoheader.module.css';
import SOCIALS from '../data/socials'

export default function Demoheader() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
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

          <div className="navlinks">
            <a href="/">Home</a>
            <a href="/news">News</a>
            <a href="/reviews">Reviews</a>
            <a href="/guides">Guides</a>
            <a href="/analysis">Analysis</a>
            <a href="/opinion">Opinion</a>
          </div>

          <div className="right">
            <button className="subscribe-btn">Subscribe</button>
          </div>

          <button
            className="hamburger"
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
        className={`${styles['mobile-menu']} ${open ? styles.active : ''}`}
        aria-hidden={!open}
        onClick={onOverlayClick}
      >
        <div className={styles['mobile-menu__panel']} role="dialog" aria-modal="true" aria-label="Main Menu" ref={panelRef}>
          <button
            className={styles['mobile-menu__close']}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>

          <ul className={styles['mobile-menu__links']}>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>

          <div className={styles['mobile-menu__socials']}>
          
            {SOCIALS.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.aria}><img src={s.img} alt={s.aria} /></a>
            ))}
          </div>

          <div className={styles['mobile-menu__cta']}>
            <button className={styles['subscribe-btn']} style={{marginTop: 18, textAlign: 'center'}}>Subscribe</button>
          </div>
        </div>
      </nav>
    </>
  );
}
