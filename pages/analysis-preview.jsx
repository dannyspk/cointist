import React from 'react'
import Head from 'next/head'
import AnalysisSection from '../components/AnalysisSection'

export default function AnalysisPreview(){
  return (
    <>
      <Head>
        <title>Analysis Section Preview</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main style={{background:'#08100d', minHeight:'100vh', padding:'28px 0'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px'}}>
          <AnalysisSection />
        </div>
      </main>
    </>
  )
}
