// Simple test to reproduce the JSON-LD object produced by SEO.js
const SOCIALS = require('../src/data/socials');
const SITE_URL = process.env.SITE_URL || 'https://cointist.net';

function buildLd({ type='article', siteName='Cointist', title, description, image, url, canonical, primaryKeyword, keywords, author, datePublished, dateModified }){
  const siteUrl = SITE_URL;
  const img = image ? (String(image).startsWith('http') ? image : `${siteUrl}${image}`) : '';
  const finalUrl = canonical || (url ? (String(url).startsWith('http') ? url : `${siteUrl}${url}`) : siteUrl);

  // Publisher logo: prefer /assets/logo.webp and add width/height when available
  const logoPath = '/assets/logo.webp'
  const logoUrl = `${siteUrl}${logoPath}`
  const publisherLogo = { '@type': 'ImageObject', url: logoUrl }
  try {
    const sizeOf = require('image-size')
    const path = require('path')
    const absLogo = path.join(process.cwd(), 'public', logoPath.replace(/^\//, ''))
    const dims = sizeOf(absLogo)
    if (dims && dims.width && dims.height) {
      publisherLogo.width = dims.width
      publisherLogo.height = dims.height
    }
  } catch (e) {
    // best-effort only
  }

  const publisher = {
    '@type': 'Organization',
    'name': siteName,
    'url': siteUrl,
    'logo': publisherLogo,
    'sameAs': Array.isArray(SOCIALS) ? SOCIALS.map(s => s.url) : undefined
  };

  const graph = [publisher];

  if (type === 'article'){
    // article image object; attempt to probe dims for local images
    const articleImageObject = img ? ({ '@type': 'ImageObject', url: img }) : undefined
    try {
      const sizeOf = require('image-size')
      const path = require('path')
      let maybeLocal = null
      if (String(img).startsWith(siteUrl)) maybeLocal = String(img).slice(siteUrl.length)
      else if (String(img).startsWith('/')) maybeLocal = String(img)
      if (maybeLocal) {
        const abs = path.join(process.cwd(), 'public', maybeLocal.replace(/^\//, ''))
        const dims = sizeOf(abs)
        if (dims && dims.width && dims.height) {
          articleImageObject.width = dims.width
          articleImageObject.height = dims.height
        }
      }
    } catch (e) {
      // ignore
    }

    // If still no dims and image is remote, try canonical sizes map
    if ((!articleImageObject.width || !articleImageObject.height) && typeof img === 'string' && String(img).startsWith('http')) {
      try {
        const canonical = require('../src/data/imageCanonicalSizes')
        const parts = String(img).split('/')
        const basename = parts[parts.length - 1]
        if (canonical && canonical[basename]) {
          articleImageObject.width = canonical[basename].width
          articleImageObject.height = canonical[basename].height
        } else if (canonical && canonical.__defaults__ && canonical.__defaults__.article) {
          articleImageObject.width = canonical.__defaults__.article.width
          articleImageObject.height = canonical.__defaults__.article.height
        }
      } catch (e) {
        // ignore
      }
    }

    const article = {
      '@type': 'NewsArticle',
      'mainEntityOfPage': { '@type': 'WebPage', '@id': finalUrl },
      'headline': title,
      'description': description,
      'url': finalUrl,
      'image': articleImageObject ? [articleImageObject] : undefined,
      'publisher': publisher,
      'author': author ? (typeof author === 'string' ? ({ '@type': 'Person', 'name': author }) : author) : undefined,
      'datePublished': datePublished || undefined,
      'dateModified': dateModified || undefined,
      'keywords': Array.isArray(keywords) && keywords.length ? keywords.join(', ') : (typeof keywords === 'string' ? keywords : undefined),
      'isAccessibleForFree': true
    };
    graph.push(article);
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

// Sample article
const sample = {
  type: 'article',
  title: 'Sample Article Title',
  description: 'A short excerpt for testing.',
  // Simulate a remote GCS-hosted image so canonical fallback is used
  image: 'https://storage.googleapis.com/cointist-assets/guides/DeFi.webp',
  url: '/guides/how-defi-protocols-work',
  author: { name: 'Cointist Editorial' },
  datePublished: '2025-08-28',
  dateModified: '2025-08-28',
  keywords: ['DeFi','AMM','lending']
};

console.log(JSON.stringify(buildLd(sample), null, 2));
