import React, { useEffect } from 'react';

export default function Header() {
  return (
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
          <li><a href="/sponsored">Sponsored</a></li>
          <li><a href="/guides">Guides</a></li>
          <li><a href="/analysis">Analysis</a></li>
          <li><a href="/opinion">Opinion</a></li>
        </ul>
        <div className="right">
          <button className="subscribe-btn">Subscribe</button>
        </div>
        <button className="hamburger" id="mobileMenuOpen" data-menu-open aria-label="Open menu">
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path d="M2 3h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 9h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 15h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile menu expected by public/assets/site.js */}
      <div id="mobile-menu" className="mobile-menu" aria-hidden="true">
        <div className="mobile-menu__panel" role="dialog" aria-modal="true">
          <div className="mobile-menu-header">
            <button id="mobileMenuClose" data-menu-close className="mobile-menu__close" aria-label="Close menu">×</button>
          </div>
          <nav className="mobile-nav">
            <ul className="mobile-menu__links">
              <li><a href="/">Home</a></li>
              <li><a href="/news">News</a></li>
              <li><a href="/sponsored">Sponsored</a></li>
              <li><a href="/guides">Guides</a></li>
              <li><a href="/analysis">Analysis</a></li>
              <li><a href="/opinion">Opinion</a></li>
            </ul>
            <div className="mobile-cta">
              <button className="subscribe-btn">Subscribe</button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

// Mobile menu positioning is handled in CSS (`src/styles/cointist.css`).
// Removed runtime inline-style adjustments so the mobile menu respects
// the stylesheet's rules (z-index/top) instead of using JS-set inline styles.
