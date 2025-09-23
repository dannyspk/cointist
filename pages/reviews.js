import Head from 'next/head'
import React from 'react'

export default function ReviewsPlaceholder(){
  return (
    <>
      <Head>
        <title>Reviews — Cointist</title>
        <meta name="description" content="Cointist reviews of wallets, exchanges, and crypto products — practical evaluations, feature comparisons, and security guidance." />
      </Head>
      <main style={{padding:32, maxWidth:960, margin:'0 auto'}}>
        <h1>Reviews</h1>
        <p>
          The Reviews section provides practical evaluations of wallets, exchanges, custody solutions,
          and tools used by crypto traders and builders. Reviews focus on security, usability,
          fees, and the transparency of the provider.
        </p>
        <p>
          When available, reviews include step-by-step setup notes, screenshots, and a short
          checklist of strengths and potential risks to help you make informed choices.
        </p>
      </main>
    </>
  )
}
