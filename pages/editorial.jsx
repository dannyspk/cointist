import React from 'react';
import SEO from '../src/components/SEO';
import SiteFooter from '../src/components/SiteFooter';

export default function Staticeditorial() {
  return (
    <>
  <SEO title="Editorial Standards" description="Cointist editorial standards — corrections, sourcing, and transparency policies." url="/editorial" canonical={(process.env.SITE_URL || 'https://cointist.net') + '/editorial'} />
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "" }} />
      <SiteFooter />
    </>
  );
}
