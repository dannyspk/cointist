import React, { useState, useEffect, useRef } from 'react';
import styles from './header.module.css';
import SOCIALS from '../data/socials';

export default function Header() {
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
      {/* Inline SVG sprite for mobile menu icons (hidden) */}
      <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style={{position:'absolute', width:0, height:0, overflow:'hidden'}}>
        <defs>
          <linearGradient id="cointist-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#29f6a1" />
            <stop offset="1" stopColor="#2ce561" />
          </linearGradient>
        </defs>

        <symbol id="icon-home" viewBox="0 0 24 24">
          <path d="M3 10.5L12 3l9 7" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M5 10.5V19a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2v-8.5" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-about" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M12 10v6" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx="12" cy="7" r="1.4" fill="url(#cointist-grad)" />
        </symbol>

        <symbol id="icon-contact" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M3 7l9 7 9-7" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-privacy" viewBox="0 0 24 24">
          <path d="M12 3l8 4v5c0 5-3.8 9.4-8 10-4.2-.6-8-5-8-10V7l8-4z" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <rect x="9" y="13" width="6" height="5" rx="1.5" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M10.5 13V11.5a1.5 1.5 0 1 1 3 0V13" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-terms" viewBox="0 0 24 24">
          <path d="M8 3h7l4 4v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M15 3v4h4" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 12h6" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 16h5" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 8l2 2 3-3" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>
      </svg>
      {/* SVG sprite (hidden) — provides gradient and symbols used by the mobile menu */}
      <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden'}}>
        <defs>
          <linearGradient id="cointist-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#29f6a1" />
            <stop offset="1" stopColor="#2ce561" />
          </linearGradient>
        </defs>

        <symbol id="icon-home" viewBox="0 0 24 24">
          <path d="M3 10.5L12 3l9 7" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M5 10.5V19a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2v-8.5" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-about" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M12 10v6" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx="12" cy="7" r="1.4" fill="url(#cointist-grad)" />
        </symbol>

        <symbol id="icon-contact" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M3 7l9 7 9-7" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-privacy" viewBox="0 0 24 24">
          <path d="M12 3l8 4v5c0 5-3.8 9.4-8 10-4.2-.6-8-5-8-10V7l8-4z" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <rect x="9" y="13" width="6" height="5" rx="1.5" stroke="url(#cointist-grad)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d="M10.5 13V11.5a1.5 1.5 0 1 1 3 0V13" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </symbol>

        <symbol id="icon-terms" viewBox="0 0 24 24">
          <path d="M8 3h7l4 4v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M15 3v4h4" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 12h6" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 16h5" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M9 8l2 2 3-3" stroke="url(#cointist-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </symbol>
      </svg>
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
            className="hamburger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display: 'block'}}>
              <rect y="7" width="32" height="4" rx="2" fill="#3ef89eff" />
              <rect y="14" width="32" height="4" rx="2" fill="#35ee8cff" />
              <rect y="21" width="32" height="4" rx="2" fill="#2ce59bff" />
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
            <li>
              <a href="/">
                <span className={styles['mobile-menu__icon']} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <use href="#icon-home" />
                  </svg>
                </span>
                <span>Home</span>
              </a>
            </li>
            <li>
              <a href="/about">
                <span className={styles['mobile-menu__icon']} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <use href="#icon-about" />
                  </svg>
                </span>
                <span>About</span>
              </a>
            </li>
            <li>
              <a href="/contact">
                <span className={styles['mobile-menu__icon']} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <use href="#icon-contact" />
                  </svg>
                </span>
                <span>Contact</span>
              </a>
            </li>
            <li>
              <a href="/privacy">
                <span className={styles['mobile-menu__icon']} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <use href="#icon-privacy" />
                  </svg>
                </span>
                <span>Privacy</span>
              </a>
            </li>
            <li>
              <a href="/terms">
                <span className={styles['mobile-menu__icon']} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <use href="#icon-terms" />
                  </svg>
                </span>
                <span>Terms</span>
              </a>
            </li>
          </ul>

          <div className={styles['mobile-menu__socials']}>
            {SOCIALS.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener" aria-label={s.aria}>
                <img src={s.img} alt={s.name} />
              </a>
            ))}
          </div>
          </div>

          <div className={styles['mobile-menu__cta']}>
            <button className={styles['subscribe-btn']} style={{marginTop: 18, textAlign: 'center'}}>Subscribe</button>
          </div>
       
      </nav>
    </>
  );
}
