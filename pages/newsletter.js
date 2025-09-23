import Head from 'next/head'
import React from 'react'

export default function Newsletter(){
  return (
    <>
      <Head>
        <title>Newsletter — Cointist</title>
        <meta name="description" content="Subscribe to the Cointist newsletter for curated crypto news, analysis, and timely market insights delivered to your inbox." />
      </Head>
      <main style={{padding:32, maxWidth:720, margin:'0 auto'}}>
        <h1>Newsletter</h1>
        <p>
          Our newsletter delivers curated headlines, concise market takeaways, and selected
          long-form pieces directly to subscribers. Sign up to receive regular updates and
          exclusive briefings from the Cointist team.
        </p>
        <p>
          We respect your inbox: expect a digest-style email with links to read more on the
          site and clear unsubscribe options in every message.
        </p>
      </main>
    </>
  )
}
