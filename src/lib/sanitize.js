import createDOMPurify from 'dompurify';

// Lazy-load JSDOM at runtime to avoid bundling the heavy 'jsdom' module
async function loadJSDOM() {
  try {
    const mod = await import('jsdom');
    return mod.JSDOM || mod.default?.JSDOM || mod;
  } catch (e) {
    // Fallback to require for CJS environments
    try { return require('jsdom').JSDOM; } catch (e2) { throw new Error('jsdom not available'); }
  }
}

export function sanitizeHtml(dirty) {
  // Parse the incoming HTML server-side, add our module classes to H2/H3,
  // then sanitize the resulting HTML. We allow a conservative set of tags
  // and attributes so authors can use headings, paragraphs, lists, blockquotes,
  // code blocks and images without those elements being stripped.
  // Load JSDOM lazily so lightweight serverless functions don't include it.
  let JSDOMClass;
  try {
    JSDOMClass = require('jsdom')?.JSDOM; // fast path for CJS builds
  } catch (e) {
    // ignore
  }
  // If not available via require, attempt dynamic import synchronously isn't possible here,
  // so fall back to a minimal sanitize without DOM transformations.
  if (!JSDOMClass) {
    // Minimal DOMPurify usage without JSDOM: create a fake window-like object
    const fakeWindow = { document: { createElement: () => ({}) } };
    const DOMPurify = createDOMPurify(fakeWindow);
    const allowedTags = [
      'p','a','strong','b','em','i','h1','h2','h3','h4','ul','ol','li',
      'blockquote','pre','code','img','figure','figcaption','br','hr',
      'table','thead','tbody','tr','th','td',
      'main','header','article','section','div','aside','footer','span'
    ];
    const allowedAttrs = [
      'href','src','alt','title','class','id','target','rel','width','height','colspan','rowspan','style'
    ];
    return DOMPurify.sanitize(dirty || '', { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: allowedAttrs });
  }

  const dom = new JSDOMClass(`<!doctype html><body>${dirty || ''}</body>`);
  const { window } = dom;

  try {
    const doc = window.document;
    const h2s = Array.from(doc.querySelectorAll('h2'));
    h2s.forEach(el => {
      if (!el.classList.contains('articleH2')) el.classList.add('articleH2');
    });
    const h3s = Array.from(doc.querySelectorAll('h3'));
    h3s.forEach(el => {
      if (!el.classList.contains('articleH3')) el.classList.add('articleH3');
    });
  } catch (e) {
    // non-fatal: fall back to sanitizing raw dirty input
  }

  const DOMPurify = createDOMPurify(window);
  const allowedTags = [
  'p','a','strong','b','em','i','h1','h2','h3','h4','ul','ol','li',
  'blockquote','pre','code','img','figure','figcaption','br','hr',
  'table','thead','tbody','tr','th','td',
  // Allow common structural and semantic tags so imported article HTML
  // can preserve wrappers and class attributes (e.g., <main>, <header>, <aside>, <footer>).
  'main','header','article','section','div','aside','footer','span'
  ];
  const allowedAttrs = [
    'href','src','alt','title','class','id','target','rel','width','height','colspan','rowspan','style'
  ];

  return DOMPurify.sanitize(window.document.body.innerHTML || '', { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: allowedAttrs });
}
