import React from 'react';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticcookies() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "<main class=\"page-wrap\"><div class=\"container page\" style=\"max-width:1100px;margin:0 auto;padding:24px 18px;font-family:'SF Pro Text','SF Pro Display',system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#e9f2ed;\">\n<section>\n<h1 style=\"font-family:'SF Pro Display',sans-serif;font-size:2rem;font-weight:650;letter-spacing:.2px;margin:6px 0 14px;\n             background:linear-gradient(90deg,#fbfffe 0%,#b7ffe3 55%,#69fe3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;\">\n    Cookie Policy\n  </h1>\n<p>We use cookies to operate the site, remember preferences, measure performance, and support limited advertising.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">Categories</h2>\n<ul style=\"margin:0 0 12px 18px;\">\n<li>Strictly necessary (login, security)</li>\n<li>Performance (analytics)</li>\n<li>Functional (preferences)</li>\n<li>Advertising (clearly disclosed; limited)</li>\n</ul>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">Your controls</h2>\n<p>Adjust your browser settings or use our banner to opt‑out of non‑essential cookies.</p>\n<p>Contact: <a href=\"mailto:privacy@cointist.com\" style=\"color:#69fe3c;\">privacy@cointist.com</a></p>\n</section>\n</div></main>" }} />
      <SiteFooter />
    </>
  );
}
