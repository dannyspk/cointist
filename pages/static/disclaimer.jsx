import React from 'react';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticdisclaimer() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "<main class=\"page-wrap\"><div class=\"container page\" style=\"max-width:1100px;margin:0 auto;padding:24px 18px;font-family:'SF Pro Text','SF Pro Display',system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#e9f2ed;\">\n<section>\n<h1 style=\"font-family:'SF Pro Display',sans-serif;font-size:2rem;font-weight:650;letter-spacing:.2px;margin:6px 0 14px;\n             background:linear-gradient(90deg,#fbfffe 0%,#b7ffe3 55%,#69fe3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;\">\n    Disclaimer\n  </h1>\n<p>Cointist publishes information for educational purposes only. Nothing on this site constitutes financial, investment, legal, or tax advice. We may hold digital assets disclosed in our editorial policy, which does not affect coverage.</p>\n</section>\n</div></main>" }} />
      <SiteFooter />
    </>
  );
}
