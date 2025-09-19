import React from 'react';
import Head from 'next/head';
import Header from '../src/components/Header.jsx';

export default function Page() {
  return (
    <div>
      <Head>
        <link rel="stylesheet" href="/styles/cointist.css" />
      </Head>
  <Header />
    </div>
  );
}
