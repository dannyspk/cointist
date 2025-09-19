#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))

async function main(){
  const url = argv.url || argv.u
  const out = argv.out || path.join(process.cwd(),'tmp','source-for-rephrase-puppeteer.txt')
  if(!url){ console.error('Usage: node puppeteer_fetch_and_dump.js --url <url> [--out <path>]'); process.exit(2) }
  try{
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({ headless: false, slowMo: 50, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-features=IsolateOrigins,site-per-process'], ignoreHTTPSErrors: true })
  let page = await browser.newPage()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    await page.setUserAgent(ua)
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    page.setDefaultNavigationTimeout(90000)
    console.error('Navigating to', url)
      // capture XHR/fetch responses to a log for inspection
      const networkLog = []
    function registerNetworkListener(p){
        try{
      if (typeof p.on === 'function') {
      p.on('response', async (res) => {
            try{
              const req = res.request()
              const type = req.resourceType()
              if(type === 'xhr' || type === 'fetch' || /api|graphql/i.test(req.url())){
                let text = ''
                try{ text = await res.text() }catch(e){ text = `<non-text response: ${e && e.message}>` }
                networkLog.push({ url: req.url(), status: res.status(), type, contentType: res.headers()['content-type'] || '', bodyPreview: (typeof text === 'string') ? text.slice(0, 2000) : '' })
              }
            }catch(e){ /* ignore */ }
      })
      }
        }catch(e){ /* ignore */ }
      }
      registerNetworkListener(page)

      // helper to navigate robustly and recreate page if frame gets detached
      async function navigateWithRetries(browser, p, targetUrl, attempts = 3){
        const uaLocal = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        for(let i=0;i<attempts;i++){
          try{
            if (p.isClosed && p.isClosed()) {
              // if page was closed recreate
              p = await browser.newPage()
              await p.setUserAgent(uaLocal)
              try{ await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' }) }catch(e){}
              p.setDefaultNavigationTimeout(120000)
              registerNetworkListener(p)
            }
            const res = await p.goto(targetUrl, { waitUntil: ['networkidle0','domcontentloaded'], timeout: 120000 })
            // log the final URL after navigation and any redirects
            try{ console.error('Navigated to (final):', p.url()) }catch(e){}
            try{
              const req = res && res.request && res.request();
              if(req && typeof req.redirectChain === 'function'){
                const chain = req.redirectChain() || []
                if(chain.length) console.error('Redirect chain:', chain.map(r => r.url()).join(' -> '))
              }
            }catch(e){}
            // wait for either article or body to be present
            await Promise.race([
              p.waitForSelector('article', { timeout: 7000 }).catch(()=>null),
              p.waitForSelector('body', { timeout: 7000 }).catch(()=>null)
            ])
            return p
          }catch(err){
            const msg = String(err || '')
            console.error(`Navigation attempt ${i+1} failed: ${msg}`)
            if(i === attempts - 1) throw err
            try{ await p.close() }catch(_){}
            p = await browser.newPage()
            await p.setUserAgent(uaLocal)
            try{ await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' }) }catch(e){}
            p.setDefaultNavigationTimeout(120000)
            registerNetworkListener(p)
          }
        }
        return p
      }
      try{
        page = await navigateWithRetries(browser, page, url, 3)
      }catch(e){
        console.error('Navigation failed after retries:', String(e))
      }

    // Auto-scroll to trigger lazy-loaded content
    async function autoScroll(p, passes = 3) {
      for(let i=0; i<passes; i++){
        await p.evaluate(async () => {
          await new Promise((resolve) => {
            var total = 0;
            var distance = 300;
            var timer = setInterval(() => {
              var scrollHeight = document.body.scrollHeight || document.documentElement.scrollHeight;
              window.scrollBy(0, distance);
              total += distance;
              if (total >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 250);
          });
        });
        // small pause between passes
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    try{ await autoScroll(page, 4) }catch(e){ console.error('autoscroll failed', String(e)) }

    // small wait after scrolling (compat fallback)
    if (typeof page.waitForTimeout === 'function') {
      await page.waitForTimeout(2000)
    } else if (typeof page.waitFor === 'function') {
      await page.waitFor(2000)
    } else {
      await new Promise((r) => setTimeout(r, 2000))
    }

  // capture XHR/fetch responses to a log for inspection
    page.on('response', async (res) => {
      try{
        const req = res.request()
        const type = req.resourceType()
        if(type === 'xhr' || type === 'fetch' || /api|graphql/i.test(req.url())){
          let text = ''
          try{ text = await res.text() }catch(e){ text = `<non-text response: ${e && e.message}>` }
          networkLog.push({ url: req.url(), status: res.status(), type, contentType: res.headers()['content-type'] || '', bodyPreview: (typeof text === 'string') ? text.slice(0, 2000) : '' })
        }
      }catch(e){ /* ignore */ }
    })

    // inject Readability and run it in the page to get a content-parsed article
    try{
      await page.addScriptTag({ url: 'https://unpkg.com/@mozilla/readability@0.4.4/Readability.js' })
    }catch(e){ /* ignore if cannot load external script */ }

    const result = await page.evaluate(() => {
      try{
        if(typeof Readability !== 'undefined'){
          const docClone = document.cloneNode(true)
          const article = new Readability(docClone).parse()
          if(article && article.textContent && article.textContent.length > 200) return { selector: 'Readability', text: article.textContent }
        }
      }catch(e){}

      function textFromNode(node){ if(!node) return ''; return node.textContent.replace(/\s+/g,' ').trim() }
      const selectors = ['article', 'main .main__content__wrapper', '.article-content', '.post-content', '.entry-content', '.content', '#content', '.story-body', '.article-body', '.article__body', '.article__content', '.news-article', '.newsarticle', '.page-content', '.post-article', '.post-article__content', '.entry__content']
      for(const sel of selectors){
        try{
          const el = document.querySelector(sel)
          if(el){ const txt = textFromNode(el); if(txt && txt.length > 200) return { selector: sel, text: txt } }
        }catch(e){}
      }
      // fallback: largest parent of p blocks
      const pNodes = Array.from(document.querySelectorAll('p'))
      if(pNodes.length){
        const blocks = new Map()
        pNodes.forEach(p => {
          const parent = p.parentElement || document.body
          const prev = blocks.get(parent) || []
          prev.push(p)
          blocks.set(parent, prev)
        })
        let best = { text: '', size: 0 }
        blocks.forEach((ps, parent) => {
          const txt = ps.map(p => textFromNode(p)).join('\n\n')
          let score = txt.length
          try{ const cls = (parent && parent.className) ? String(parent.className).toLowerCase() : ''; if(cls.includes('article')||cls.includes('content')||parent.closest && parent.closest('article')) score += 200 }catch(e){}
          if(score > best.size){ best = { text: txt, size: score } }
        })
        if(best.size > 200) return { selector: 'p-block', text: best.text }
      }
      // last fallback: body text
      return { selector: 'body-fallback', text: textFromNode(document.body || document.documentElement).slice(0,20000) }
    })

    await browser.close()
      const dir = path.dirname(out)
      if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const ts = Date.now()
      const header = `Source: ${url}\nSelector: ${result && result.selector ? result.selector : ''}\n\n`
      fs.writeFileSync(out, header + (result && result.text ? result.text : ''), 'utf8')
      // save HTML snapshot and screenshot and network log for debugging
      try{
        const htmlPath = path.join(dir, `snapshot-${ts}.html`)
        const pngPath = path.join(dir, `screenshot-${ts}.png`)
        // reopen browser to get full HTML? we already closed browser; instead re-fetch raw HTML via a separate fetch
        try{
          const fetch = require('node-fetch')
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          const raw = await r.text()
          fs.writeFileSync(htmlPath, raw, 'utf8')
        }catch(e){ fs.writeFileSync(path.join(dir, `snapshot-${ts}.html.err.txt`), String(e), 'utf8') }
        // Screenshot: try to capture by relaunching a headless page quickly
        try{
          const puppeteer2 = require('puppeteer')
          const b2 = await puppeteer2.launch({ headless: false, slowMo: 50, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-features=IsolateOrigins,site-per-process'], ignoreHTTPSErrors: true })
          const p2 = await b2.newPage()
          await p2.setUserAgent('Mozilla/5.0')
          await p2.goto(url, { waitUntil: 'networkidle2', timeout: 90000 })
          await p2.screenshot({ path: pngPath, fullPage: true })
          await b2.close()
        }catch(e){ fs.writeFileSync(path.join(dir, `screenshot.err.txt`), String(e), 'utf8') }

        const netPath = path.join(dir, `network-log-${ts}.json`)
        fs.writeFileSync(netPath, JSON.stringify(networkLog, null, 2), 'utf8')
      }catch(e){ console.error('failed to write debug artifacts', String(e)) }

      console.log('Wrote', out)
    process.exit(0)
  }catch(e){
    console.error('Puppeteer fetch failed:', e && e.message ? e.message : e)
    process.exit(1)
  }
}

if(require.main===module) main()
