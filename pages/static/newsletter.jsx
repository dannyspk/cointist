import React from 'react';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticnewsletter() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "<main class=\"page-wrap\"><div class=\"container page\" style=\"max-width:1100px;margin:0 auto;padding:24px 18px;font-family:'SF Pro Text','SF Pro Display',system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#e9f2ed;\">\r\n<section>\r\n<h1 style=\"font-family:'SF Pro Display',sans-serif;font-size:2rem;font-weight:650;letter-spacing:.2px;margin:6px 0 14px;\r\n             background:linear-gradient(90deg,#fbfffe 0%,#b7ffe3 55%,#69fe3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;\">\r\n    Cointist Newsletter\r\n  </h1>\r\n<p>Smart crypto news, every few days. No spam, easy unsubscribe.</p>\r\n<form action=\"/newsletter/subscribe\" method=\"post\" style=\"display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;\">\r\n<input name=\"email\" placeholder=\"your@email\" required=\"\" style=\"flex:1;min-width:240px;padding:12px;border-radius:12px;border:1px solid #2a3530;background:#0f1311;color:#e9f2ed;\" type=\"email\"/>\r\n<button style=\"padding:12px 16px;border-radius:14px;border:none;\r\n      background:linear-gradient(90deg,#29f6a1 0%, #14f195 100%);color:#0d1411;font-weight:600;box-shadow:0 6px 18px rgba(20,241,149,.25);cursor:pointer;\" type=\"submit\">\r\n      Subscribe\r\n    </button>\r\n</form>\r\n<small style=\"opacity:.8;\">By subscribing you agree to our <a href=\"/terms.html\" style=\"color:#69fe3c;\">Terms</a> and <a href=\"/privacy.html\" style=\"color:#69fe3c;\">Privacy Policy</a>.</small>\r\n</section>\r\n</div></main>" }} />
      <SiteFooter />
    </>
  );
}
