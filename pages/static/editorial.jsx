import React from 'react';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticeditorial() {
  return (
    <>
      {/* Topbar & Header are rendered globally in pages/_app.js; only render main content here */}
      <div dangerouslySetInnerHTML={{ __html: "" }} />
      <SiteFooter />
    </>
  );
}
