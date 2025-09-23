import '../src/styles/cointist.css';
import '../src/styles/cointist-sectors.css';
import '../src/styles/globals.css';
// touched to trigger reload
import '../src/styles/advertise.css';
import '../src/styles/authors.css';
import Head from 'next/head'
import Script from 'next/script';
import Header from '../src/components/Header.jsx';
import Topbar from '../src/components/Topbar';
import SOCIALS from '../src/data/socials'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
  {/* Preload only the primary UI font weight needed for initial render to reduce TTFB and total bytes.
      Other weights will be loaded via @font-face when required (font-display: swap prevents invisible text).
      If you later want to prioritize a different weight for above-the-fold content, update this href to that subset. */}
  <link rel="preload" href="/assets/fonts/SF-Pro-Text-Regular-subset.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
  {/* Font link moved to _document.js per Next.js recommendation (avoid using <link rel="stylesheet"> inside next/head) */}
  {/* Site-wide metadata moved to per-page SEO component to avoid overriding page-specific meta tags */}
  <meta property="og:site_name" content="Cointist" />
  <meta name="twitter:site" content="@cointist" />
  {/* Optimized small favicon (webp) + sensible fallbacks */}
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  {/* Load guides-layout.css non-blocking: preload then apply onload, with noscript fallback */}
  <link rel="preload" href="/styles/guides-layout.min.css" as="style" onLoad="this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="/styles/guides-layout.min.css" /></noscript>
        {/* Organization JSON-LD using canonical social profiles */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Cointist",
          "url": "https://cointist.com",
          "logo": "https://cointist.com/assets/logo.png",
          "sameAs": SOCIALS.map(s => s.url)
        }) }} />
      </Head>
  {/* Legacy scripts loaded; apply a small safeguard so removeChild calls that target non-children don't throw.
      This prevents the console error "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
      We wrap the DOM API very conservatively and only when not already wrapped. */}
  <Script id="safe-remove-child" strategy="beforeInteractive">
    {`(function(){
      try {
        if (typeof Node === 'undefined') return;
        if (Node.prototype.__removeChild_safe_wrapped) return;
        var orig = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child){
          try {
            if (!child) return orig.call(this, child);
            if (child.parentNode === this) return orig.call(this, child);
            // Not a child anymore — ignore to avoid uncaught DOMException
            return child;
          } catch (e) {
            // If something unexpected happens, fallback to original behavior
            try { return orig.call(this, child); } catch (_) { return child; }
          }
        };
        Node.prototype.__removeChild_safe_wrapped = true;
      } catch (e) { /* failure to patch should not block app */ }
    })();`}
  </Script>
  {/* Load Chart.js (keep). Legacy DOM-manipulating scripts are removed to avoid conflicts with React components. */}
  <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="lazyOnload" />
  {/* Google Analytics (gtag.js) */}
  <Script src="https://www.googletagmanager.com/gtag/js?id=G-SZ72NFJMWD" strategy="afterInteractive" />
  <Script id="gtag-init" strategy="afterInteractive">
    {`window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);} 
    gtag('js', new Date());
    gtag('config', 'G-SZ72NFJMWD');`}
  </Script>
  {/* Legacy site script removed: SectorIndices and market widgets are React-driven now. */}
      {/* Header sticky fallback: simple approach for older browsers (stable release) */}
      <Script id="header-sticky-fallback" strategy="afterInteractive">
        {`(function(){ try { var header = document.querySelector('.site-header, header.site-header'); if(!header) return; var origTop = header.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0); function onScroll(){ var pageY = window.pageYOffset || document.documentElement.scrollTop || 0; if(pageY > origTop) { header.style.position='fixed'; header.style.top='0'; header.style.left='0'; header.style.right='0'; header.style.zIndex='11000'; } else { header.style.position=''; header.style.top=''; header.style.left=''; header.style.right=''; header.style.zIndex=''; } } window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', function(){ origTop = header.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0); }, { passive: true }); requestAnimationFrame(onScroll); } catch(e){} })();`}
      </Script>

  <div className="page-wrapper">
    <div className="page-content">
      <Topbar />
      <Header />
      <Component {...pageProps} />
    </div>
    {/* Footer lives after page-content so it stays at the bottom */}
  </div>
  {/* Development-only: suppress noisy Fast Refresh / HMR logs that start with "[Fast Refresh]" or "[HMR]" */}
  {process.env.NODE_ENV !== 'production' && (
  null
  )}
    </>
  );
}
