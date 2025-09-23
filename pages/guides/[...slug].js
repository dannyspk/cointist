import Head from 'next/head'
import React from 'react'

export default function GuideCatchAll({ params }){
  return (
    <>
      <Head>
        <title>Guide — Cointist</title>
        <meta name="description" content="Practical guides and walkthroughs for crypto topics — wallets, staking, DeFi, and developer concepts. This catch-all page routes to the canonical guide content when available." />
      </Head>
      <main style={{padding:32, maxWidth:960, margin:'0 auto'}}>
        <h1>Guide</h1>
        <p>
          This page is a catch-all route for Guides and helps search engines discover our
          beginner-friendly walkthroughs, how-tos, and reference articles. If you've arrived
          here from an outdated link, use the site navigation to find the most recent and
          canonical guide content on wallets, smart contracts, and core blockchain concepts.
        </p>
        <p>
          The specific guide requested: <strong>{Array.isArray(params && params.slug) ? params.slug.join('/') : ''}</strong>
        </p>
      </main>
    </>
  )
}

export async function getServerSideProps({ params }){
  return { props: { params } }
}
