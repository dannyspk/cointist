import Head from 'next/head'
import React from 'react'

export default function NewsPlaceholder(){
  return (
    <>
      <Head>
        <title>News — Cointist</title>
        <meta name="description" content="Latest crypto news, market updates, and timely analysis from Cointist. This page is a placeholder listing for site navigation and will be replaced with the full news index." />
      </Head>
      <main style={{padding:32, maxWidth:960, margin:'0 auto'}}>
        <h1>News</h1>
        <p>
          Cointist publishes timely coverage of the crypto industry — breaking news, protocol
          updates, market-moving announcements, and short-form reporting you can rely on. This
          page currently serves as a lightweight listing and navigation entry while the full
          News index is being finalized. You'll find concise headlines, links to full articles,
          and brief summaries that make it easy to scan today's most important stories.
        </p>
        <p>
          We aim to provide accurate, clear, and fast updates. If you're looking for deeper
          analysis or guides, check the "Guides" and "Analysis" sections in the main menu.
        </p>
      </main>
    </>
  )
}
