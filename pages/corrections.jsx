import React from 'react';
  import SiteFooter from '../src/components/SiteFooter';

export default function Staticcorrections() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "<main class=\"page-wrap\"><div class=\"container page\" style=\"max-width:1100px;margin:0 auto;padding:24px 18px;font-family:'SF Pro Text','SF Pro Display',system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#e9f2ed;\">\n<section>\n<h1 style=\"font-family:'SF Pro Display',sans-serif;font-size:2rem;font-weight:650;letter-spacing:.2px;margin:6px 0 14px;\n             background:linear-gradient(90deg,#fbfffe 0%,#b7ffe3 55%,#69fe3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;\">\n    Corrections &amp; Updates\n  </h1>\n<p>We maintain a public log of substantive corrections and clarifications.</p>\n<div style=\"border:1px solid #26332d;border-radius:14px;padding:12px;background:#0f1311;\">\n<p style=\"margin:0;\"><em>No corrections yet.</em></p>\n</div>\n<p style=\"margin-top:10px;\">See our <a href=\"/editorial.html\" style=\"color:#69fe3c;\">Editorial Policy</a> for more.</p>\n</section>\n</div></main>" }} />
      <SiteFooter />
    </>
  );
}
