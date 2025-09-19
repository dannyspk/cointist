import React from 'react'
import Head from 'next/head'
import SOCIALS from '../data/socials'
import canonicalSizes from '../data/imageCanonicalSizes'

export default function SEO({ title, description, image, url, canonical, type = 'article', schemaType = undefined, siteName = 'Cointist', primaryKeyword, keywords, author, datePublished, dateModified }) {
  const siteUrl = process.env.SITE_URL || 'https://cointist.net'
  // Normalize title and ensure site name suffix. Strip common trailing site-name variants
  // so callers can pass titles like "Guides — Cointist" without causing "Cointist | Cointist".
  const stripSiteSuffix = (t) => {
    if (!t) return t
    // remove trailing separators followed by site name (e.g. " | Cointist", " — Cointist", " - Cointist", "• Cointist")
    return String(t).replace(/\s*([|\u2013\u2014\-\u2022\u00B7])\s*Cointist\s*$/i, '').trim()
  }
  // If a page title is provided, normalize and append the site name.
  // If no page title is provided, use the previous working default: "Cointist | Crypto News, Data & Deep Dives"
  const baseTitle = title ? stripSiteSuffix(title) : null
  // If a primary keyword is provided and not present in the base title, append it for stronger signal
  const titleWithKeyword = baseTitle && primaryKeyword && !baseTitle.toLowerCase().includes(String(primaryKeyword).toLowerCase()) ? `${baseTitle} — ${primaryKeyword}` : baseTitle
  const fullTitle = baseTitle ? `${titleWithKeyword || baseTitle} | ${siteName}` : `${siteName} | Crypto News, Data & Deep Dives`
  // Description: prefer provided description; otherwise fall back to site default. If primaryKeyword is present ensure description contains it.
  const defaultDesc = 'Independent crypto news and data-driven analysis — market insights, weekly reports, and practical guides for investors and builders.'
  let desc = description || defaultDesc
  if (primaryKeyword && !String(desc).toLowerCase().includes(String(primaryKeyword).toLowerCase())) {
    desc = `${primaryKeyword} — ${desc}`
  }
  const img = image ? (String(image).startsWith('http') ? image : `${siteUrl}${image}`) : ''
  const finalUrl = canonical || (url ? (String(url).startsWith('http') ? url : `${siteUrl}${url}`) : siteUrl)

  // Build JSON-LD for Organization (publisher) and NewsArticle when applicable.
  // Prefer the WebP logo in public assets; add width/height when running on server
  const logoPath = '/assets/logo.webp'
  const logoUrl = `${siteUrl}${logoPath}`
  const publisherLogo = { '@type': 'ImageObject', 'url': logoUrl }
  if (typeof window === 'undefined') {
    try {
      // require at runtime to avoid bundling fs into client bundle
      const sizeOf = require('image-size')
      const path = require('path')
      const absLogo = path.join(process.cwd(), 'public', logoPath.replace(/^\//, ''))
      const dims = sizeOf(absLogo)
      if (dims && dims.width && dims.height) {
        publisherLogo.width = dims.width
        publisherLogo.height = dims.height
      } else if (canonicalSizes && canonicalSizes['logo.webp']) {
        // fallback to canonical sizes for remote-hosted logos
        publisherLogo.width = canonicalSizes['logo.webp'].width
        publisherLogo.height = canonicalSizes['logo.webp'].height
      }
    } catch (e) {
      // ignore - best-effort only; try canonical fallback below
      if (canonicalSizes && canonicalSizes['logo.webp']) {
        publisherLogo.width = canonicalSizes['logo.webp'].width
        publisherLogo.height = canonicalSizes['logo.webp'].height
      }
    }
  }

  const publisher = {
    '@type': 'Organization',
    'name': siteName,
    'url': siteUrl,
    'logo': publisherLogo,
    'sameAs': Array.isArray(SOCIALS) ? SOCIALS.map(s => s.url) : undefined
  };

  const graph = [publisher];

  if (type === 'article') {
    // Build image object for article; if the image is local try to probe its size on server
    const articleImageObject = img ? ({ '@type': 'ImageObject', 'url': img }) : undefined
    if (img) {
      // Try server-side probing for local images
      if (typeof window === 'undefined') {
        try {
          const sizeOf = require('image-size')
          const path = require('path')
          // If img is a site-relative path (/assets/...) convert to public path
          let maybeLocal = null
          if (String(img).startsWith(siteUrl)) {
            maybeLocal = String(img).slice(siteUrl.length)
          } else if (String(img).startsWith('/')) {
            maybeLocal = String(img)
          }
          if (maybeLocal) {
            const abs = path.join(process.cwd(), 'public', maybeLocal.replace(/^\//, ''))
            const dims = sizeOf(abs)
            if (dims && dims.width && dims.height) {
              articleImageObject.width = dims.width
              articleImageObject.height = dims.height
            }
          }
        } catch (e) {
          // ignore - will try canonical fallback below
        }
      }

      // If no dims found yet and the image is remote (GCS/CDN), try canonical map by basename
      if ((!articleImageObject.width || !articleImageObject.height) && typeof img === 'string' && String(img).startsWith('http')) {
        try {
          const urlParts = String(img).split('/')
          const basename = urlParts[urlParts.length - 1]
          if (canonicalSizes && canonicalSizes[basename]) {
            articleImageObject.width = canonicalSizes[basename].width
            articleImageObject.height = canonicalSizes[basename].height
          } else if (canonicalSizes && canonicalSizes.__defaults__ && canonicalSizes.__defaults__.article) {
            articleImageObject.width = canonicalSizes.__defaults__.article.width
            articleImageObject.height = canonicalSizes.__defaults__.article.height
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // Ensure we always include an author (fallback to site Organization when none provided).
    const authorNode = author ? (typeof author === 'string' ? ({ '@type': 'Person', 'name': author }) : author) : ({ '@type': 'Organization', 'name': siteName })

    // Decide JSON-LD Article type: prefer 'Article' for evergreen guides, otherwise 'NewsArticle'.
    // Allow explicit override with `schemaType` prop.
    let articleJsonLdType = 'NewsArticle'
    try{
      const urlToCheck = finalUrl || url || '';
      if (schemaType) {
        articleJsonLdType = schemaType
      } else if (typeof urlToCheck === 'string' && urlToCheck.includes('/guides/')) {
        articleJsonLdType = 'Article'
      } else if (type && String(type).toLowerCase() === 'guide') {
        articleJsonLdType = 'Article'
      }
    }catch(e){}

    const article = {
      '@type': articleJsonLdType,
      'mainEntityOfPage': { '@type': 'WebPage', '@id': finalUrl },
      'headline': fullTitle,
      'description': desc,
      'url': finalUrl,
      'image': articleImageObject ? [articleImageObject] : undefined,
      'publisher': publisher,
      'author': authorNode,
      'datePublished': datePublished || undefined,
      'dateModified': dateModified || undefined,
      'keywords': Array.isArray(keywords) && keywords.length ? keywords.join(', ') : (typeof keywords === 'string' ? keywords : undefined),
      'isAccessibleForFree': true
    };
    graph.push(article);
  }

  const ld = { '@context': 'https://schema.org', '@graph': graph };

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {/* Keywords meta: help tests and crawlers detect primary terms for the site */}
      { (Array.isArray(keywords) && keywords.length) || primaryKeyword ? (
        <meta name="keywords" content={(Array.isArray(keywords) && keywords.length) ? keywords.join(', ') : String(primaryKeyword)} />
      ) : null }
  <meta name="robots" content="index, follow" />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      {img ? <meta property="og:image" content={img} /> : null}
      {finalUrl ? <meta property="og:url" content={finalUrl} /> : null}

      <meta name="twitter:card" content={img ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />

      {finalUrl ? <link rel="canonical" href={finalUrl} /> : null}
  {/* Helpful for domain-level verification and some SEO tools: point to primary site */}
  <meta name="application-name" content="Cointist" />

  {/* JSON-LD structured data for Organization (publisher) and NewsArticle (when applicable) */}
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </Head>
  )
}
