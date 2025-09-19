const fetch = global.fetch || require('node-fetch')
const { JSDOM } = require('jsdom')
;(async function(){
  const url = 'https://ffnews.com/newsarticle/cryptocurrency/bingx-launches-ai-master-the-world-first-ai-crypto-trading-strategist/'
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'cointist-scraper/1.0' }, timeout: 20000 })
    const html = await res.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document
    function anc(el){
      const parts = []
      let cur = el
      while(cur && cur.tagName){
        const cls = cur.className ? ` class="${String(cur.className).slice(0,100)}"` : ''
        const id = cur.id ? ` id="${cur.id}"` : ''
        parts.push(`<${cur.tagName.toLowerCase()}${id}${cls}>`)
        cur = cur.parentElement
      }
      return parts.join(' > ')
    }
    const h1 = doc.querySelector('h1') || doc.querySelector('h2')
    console.log('Found heading tag:', h1 && h1.tagName, 'text:', h1 && h1.textContent && h1.textContent.trim().slice(0,120))
    if(h1) console.log('Heading ancestor chain:', anc(h1))

    const main = doc.querySelector('main')
    console.log('\nmain element present?', !!main)
    if(main){
      console.log('main class/id:', main.className || main.id || '<none>')
      const mainTextSample = (main.textContent||'').replace(/\s+/g,' ').trim().slice(0,1200)
      console.log('\nmain text sample (first 1200 chars):\n', mainTextSample)
    }

    const article = doc.querySelector('article')
    console.log('\narticle element present?', !!article)
    if(article){
      console.log('article ancestor chain:', anc(article))
      const articleTextSample = (article.textContent||'').replace(/\s+/g,' ').trim().slice(0,1200)
      console.log('\narticle text sample (first 1200 chars):\n', articleTextSample)
    }

    // find likely article body container by class keywords
    const cand = doc.querySelector('div[class*="article"], div[class*="content"], section[class*="article"], section[class*="content"], .article-body, .article__body')
    console.log('\ncandidate container present?', !!cand, cand && (cand.className||cand.id))
    if(cand){
      console.log('candidate ancestor chain:', anc(cand))
      console.log('\ncandidate text sample (first 1000 chars):\n', (cand.textContent||'').replace(/\s+/g,' ').trim().slice(0,1000))
    }

  }catch(e){ console.error('ERR', e && e.message) }
})()
