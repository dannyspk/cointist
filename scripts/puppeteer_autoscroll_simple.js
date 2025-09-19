#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const url = argv.url || argv.u
const out = argv.out || path.join(process.cwd(),'tmp','source-autoscroll.txt')
if(!url){ console.error('Usage: node puppeteer_autoscroll_simple.js --url <url> --out <path>'); process.exit(2) }
;(async ()=>{
  try{
    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox','--disable-setuid-sandbox'], defaultViewport: { width: 1200, height: 900 } })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    console.error('Navigating to', url)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
    // auto-scroll: stop when page height stabilizes or after max passes
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let passes = 0
        let lastHeight = 0
        const maxPasses = 12
        const distance = 300
        const interval = 350
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight || document.documentElement.scrollHeight
          window.scrollBy(0, distance)
          // if height hasn't changed and we've scrolled past it, stop
          if(scrollHeight === lastHeight){ passes += 1 } else { passes = 0 }
          lastHeight = scrollHeight
          // if we've done enough stable passes or reached a safety max, stop
          if(passes >= 3 || maxPasses-- <= 0){ clearInterval(timer); resolve() }
        }, interval)
      })
    })
    // wait a bit after scroll
    await new Promise(r => setTimeout(r, 1500))
    // extract largest article-like block
    const result = await page.evaluate(() => {
      function txt(n){ return n ? n.innerText.replace(/\s+/g,' ').trim() : '' }
      const selectors = ['article', '.article-content', '.post-content', '.entry-content', '.article__content', '.post-article__content', '.content', '#content']
      for(const s of selectors){ const el = document.querySelector(s); if(el && txt(el).length>200) return { selector: s, text: txt(el) } }
      // fallback: largest parent of <p>
      const ps = Array.from(document.querySelectorAll('p'))
      if(ps.length){
        const groups = new Map()
        ps.forEach(p => { const parent = p.parentElement || document.body; const arr = groups.get(parent) || []; arr.push(p); groups.set(parent, arr) })
        let best = { text:'', size:0 }
        for(const [parent, arr] of groups){ const t = arr.map(x=>txt(x)).join('\n\n'); const score = t.length + ((parent.className||'').toLowerCase().includes('article')?200:0); if(score>best.size){ best={ text:t, size:score } } }
        if(best.size>200) return { selector: 'p-block', text: best.text }
      }
      return { selector: 'body', text: txt(document.body).slice(0,20000) }
    })
    const dir = path.dirname(out); if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const header = `Source: ${url}\nSelector: ${result.selector}\n\n`
    fs.writeFileSync(out, header + (result.text||''), 'utf8')
    console.log('Wrote', out)
    // also save an html snapshot and screenshot for inspection
    try{ const ts = Date.now(); await page.screenshot({ path: path.join(dir, `screenshot-autoscroll-${ts}.png`), fullPage: true }); const html = await page.content(); fs.writeFileSync(path.join(dir, `snapshot-autoscroll-${ts}.html`), html, 'utf8') }catch(e){ console.error('snapshot failed', e && e.message)}
    await browser.close()
    process.exit(0)
  }catch(e){ console.error('autoscroll extractor failed', e && e.message); process.exit(1) }
})()
