import React from 'react';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticterms() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "<main class=\"page-wrap\">\n<div class=\"container page\" style=\"max-width:1100px;margin:0 auto;padding:24px 18px;font-family:'SF Pro Text','SF Pro Display',system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#e9f2ed;\">\n<section>\n<h1 style=\"font-family:'SF Pro Display',sans-serif;font-size:2rem;font-weight:650;letter-spacing:.2px;margin:6px 0 14px;\n             background:linear-gradient(90deg,#fbfffe 0%,#b7ffe3 55%,#69fe3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;\">\n    Terms &amp; Conditions\n  </h1>\n<p>Effective date: August 15, 2025</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">1. Acceptance</h2>\n<p>By accessing Cointist, you agree to these Terms.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">2. Use of content</h2>\n<p>Articles are for personal, non–commercial use unless permission is granted. Do not republish without attribution and consent.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">3. No financial advice</h2>\n<p>Content is for information only and not investment, legal, or tax advice. Markets are risky; do your own research.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">4. Accounts</h2>\n<p>You are responsible for the security of your account and complying with applicable laws.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">5. Liability</h2>\n<p>We provide the service “as is” and disclaim warranties to the fullest extent permitted by law.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">6. Governing law</h2>\n<p>Disputes will be resolved under applicable local laws where Cointist is operated, unless otherwise required.</p>\n<h2 style=\"font-size:1.25rem;margin:12px 0 6px;\">7. Changes</h2>\n<p>We may update these Terms; continued use means acceptance.</p>\n<p>Contact: <a href=\"mailto:legal@cointist.com\" style=\"color:#69fe3c;\">legal@cointist.com</a></p>\n</section>\n</div>\n</main>" }} />
      <SiteFooter />
    </>
  );
}
