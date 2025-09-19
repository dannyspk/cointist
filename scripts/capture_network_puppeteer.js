#!/usr/bin/env node
const puppeteer = require('puppeteer');
const { URL } = require('url');

(async function main(){
  try {
    const arg = process.argv[2];
    if (!arg) { console.error('Usage: node capture_network_puppeteer.js <url>'); process.exit(2); }
    const url = arg;
    console.log('Starting network capture for', url);

    console.log('Puppeteer package info:', { version: require('puppeteer/package.json').version });

    // attempt to show executable path if available
    try {
      const execPath = puppeteer.executablePath && puppeteer.executablePath();
      if (execPath) console.log('Bundled Chromium executable path:', execPath);
    } catch (e) {
      // ignore
    }

    const launchOpts = { headless: true, args:['--no-sandbox','--disable-setuid-sandbox'], ignoreHTTPSErrors: true };
    console.log('Launching browser with options:', launchOpts);
  const browser = await puppeteer.launch(launchOpts);
    console.log('Browser launched');
    const page = await browser.newPage();
  // set a common desktop user agent to avoid bot blocking
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  page.setDefaultNavigationTimeout(120000);

    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    const requests = {};
  let seenRequests = 0;

    client.on('Network.requestWillBeSent', (params) => {
      const { requestId, request } = params;
      requests[requestId] = requests[requestId] || {};
      requests[requestId].url = request.url;
      requests[requestId].method = request.method;
  seenRequests++;
  if (seenRequests <= 10) console.log('DBG requestWillBeSent:', request.method, request.url);
    });

    client.on('Network.responseReceived', (params) => {
      const { requestId, response } = params;
      requests[requestId] = requests[requestId] || {};
      requests[requestId].status = response.status;
      requests[requestId].mimeType = response.mimeType;
      requests[requestId].headers = response.headers || {};
  if (seenRequests <= 10) console.log('DBG responseReceived:', response.status, response.url);
    });

    client.on('Network.loadingFinished', (params) => {
      const { requestId, encodedDataLength } = params;
      requests[requestId] = requests[requestId] || {};
      requests[requestId].encodedDataLength = encodedDataLength;
  if (seenRequests <= 10) console.log('DBG loadingFinished:', requestId, encodedDataLength);
    });

    client.on('Network.loadingFailed', (params) => {
      const { requestId, errorText, canceled } = params;
      requests[requestId] = requests[requestId] || {};
      requests[requestId].failed = true;
      requests[requestId].failReason = errorText;
      requests[requestId].canceled = canceled;
  if (seenRequests <= 10) console.log('DBG loadingFailed:', requestId, errorText, 'canceled=', canceled);
    });

    // navigate and wait
    console.log('Navigating to', url);
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      console.log('page.goto response status:', resp && resp.status ? resp.status() : 'no-response');
    } catch (navErr) {
      console.error('Navigation error:', navErr && navErr.message ? navErr.message : navErr);
    }
    console.log('Page navigation complete (or timed out), waiting for lazy-loaded assets...');
    // small sleep helper because some puppeteer installs don't expose page.waitForTimeout
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    // capture page console messages to surface runtime JS blocking
    page.on('console', msg => {
      try { console.log('PAGE_CONSOLE:', msg.type(), msg.text()); } catch(e) {}
    });
    page.on('dialog', async dialog => { console.log('PAGE_DIALOG:', dialog.message()); await dialog.dismiss().catch(()=>{}); });
    await sleep(8000);

    const rows = [];
    for (const r of Object.values(requests)) {
      if (!r.url) continue;
      const encoded = r.encodedDataLength || 0;
      const encHeader = (r.headers && (r.headers['content-encoding'] || r.headers['Content-Encoding'])) || '';
      rows.push({ url: r.url, encoded, encHeader, mime: r.mimeType || '', status: r.status || '' });
    }

  rows.sort((a,b) => b.encoded - a.encoded);

    console.log('URL,ENCODED_BYTES,CONTENT_ENCODING,MIME,HTTP_STATUS');
    let total = 0;
  for (const r of rows) {
      total += r.encoded;
      // CSV-safe quoting for URL
      console.log(`"${r.url}",${r.encoded},${r.encHeader},${r.mime},${r.status}`);
    }
  console.log('TOTAL_ENCODED_BYTES:', total);
  console.log('SUMMARY: requests_captured=', rows.length);

  await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR during capture:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
