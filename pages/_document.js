import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Primary favicon (PNG) */}
          <link rel="icon" type="image/png" href="/favicon.png" />
          {/* Fallbacks for older browsers/devices */}
        
          <link rel="apple-touch-icon" href="/favicon.png" />
          <meta name="theme-color" content="#ffffff" />
          {/* keep Head minimal; font loading is handled via next/font (self-hosted/optimized) in _app.js */}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
