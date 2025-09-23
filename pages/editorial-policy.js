import Head from 'next/head'
import React from 'react'

export default function EditorialPolicy(){
  return (
    <>
      <Head>
        <title>Editorial Policy — Cointist</title>
        <meta name="description" content="Cointist editorial standards: transparency, corrections, sponsored content policies, and conflict-of-interest disclosures." />
      </Head>
      <main style={{padding:32, maxWidth:960, margin:'0 auto'}}>
        <h1>Editorial Policy</h1>
        <p>
          Cointist is committed to transparent editorial practices. We clearly label sponsored
          content, correct factual errors promptly, and disclose conflicts of interest where
          relevant. Our editorial team follows standards to separate advertising from reporting.
        </p>
        <p>
          For detailed guidelines, including how corrections are handled and how sponsored
          posts are reviewed, contact our editorial team or consult the full policy when
          published.
        </p>
      </main>
    </>
  )
}
