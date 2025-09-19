import React from 'react';
import SOCIALS from '../data/socials'

export default function Topbar() {
  return (
    <div className="topbar-socials">
      <nav className="topbar-links">
        <a href="/about">About Us</a>
        <a href="/contact">Contact Us</a>
        <a href="/newsletter">Courses</a>
        <a href="/advertise">Advertise</a>
      </nav>
      {SOCIALS.map(s => (
        <a key={s.name} href={s.url} target="_blank" rel="noopener" aria-label={s.aria}><img src={s.img} alt={s.aria} /></a>
      ))}
      {/* Theme toggle button logic will be migrated to React later */}
      <button className="theme-toggle" aria-label="Toggle theme">
        <span className="icon-wrap" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 19v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.22 4.22l1.42 1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.36 18.36l1.42 1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.22 19.78l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <span className="theme-sep">/</span>
        <span className="icon-wrap" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor" />
          </svg>
        </span>
      </button>
    </div>
  );
}
