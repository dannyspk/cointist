const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const OWNER = 'dannyspk';
const REPO = 'cointist';
const WORKFLOW_FILE = 'generate-sitemap-news.yml';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN not set');
  process.exit(2);
}
function ghGet(path) {
  const options = {
    hostname: 'api.github.com',
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'cointist-agent',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${TOKEN}`,
    }
  };
  return new Promise((resolve,reject)=>{
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch(e) { resolve({raw: data}); }
        } else {
          reject({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
function ghGetBinary(path, dest) {
  const options = {
    hostname: 'api.github.com',
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'cointist-agent',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${TOKEN}`,
    }
  };
  return new Promise((resolve,reject)=>{
    const file = fs.createWriteStream(dest);
    const req = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        const loc = new URL(res.headers.location);
        const h2 = https.request(loc, r2 => {
          r2.pipe(file);
          r2.on('end', ()=> resolve());
          r2.on('error', reject);
        });
        h2.end();
        return;
      }
      if (res.statusCode !== 200) return reject({ status: res.statusCode });
      res.pipe(file);
      res.on('end', ()=> resolve());
    });
    req.on('error', reject);
    req.end();
  });
}
(async ()=>{
  try {
    console.log('Listing recent workflow runs...');
    const runsRes = await ghGet(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`);
    const runs = runsRes.workflow_runs || runsRes;
    if (!runs || runs.length === 0) {
      console.error('No workflow runs found'); process.exit(3);
    }
    // pick the most recent run
    runs.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    const run = runs[0];
    console.log('Found run id:', run.id, 'status:', run.status, 'conclusion:', run.conclusion);
    // poll until completed
    let attempts = 0;
    let maxAttempts = 30;
    let runInfo = run;
    while (runInfo.status !== 'completed' && attempts < maxAttempts) {
      attempts++;
      console.log('Polling run status... attempt', attempts);
      await new Promise(r=>setTimeout(r, 5000));
      try {
        runInfo = (await ghGet(`/repos/${OWNER}/${REPO}/actions/runs/${run.id}`)) || runInfo;
        console.log('Status now:', runInfo.status);
      } catch (e) {
        console.error('Failed to poll run status', e);
      }
    }
    if (runInfo.status !== 'completed') {
      console.warn('Run did not complete within timeout, continuing with latest available status');
    }
    console.log('Downloading logs for run id', run.id);
    const zipDest = `tmp/workflow-${run.id}-logs.zip`;
    if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');
    await ghGetBinary(`/repos/${OWNER}/${REPO}/actions/runs/${run.id}/logs`, zipDest);
    console.log('Saved logs to', zipDest);
    const outDir = `tmp/workflow-${run.id}-logs`;
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir);
    // Use PowerShell Expand-Archive to extract (cross-platform fallback not included)
    try {
      console.log('Extracting logs (PowerShell Expand-Archive)...');
      execSync(`powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${zipDest}' -DestinationPath '${outDir}'"`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to extract logs via PowerShell:', e.message);
      process.exit(4);
    }
    // Walk extracted files and print relevant job logs
    const files = fs.readdirSync(outDir, { withFileTypes: true });
    console.log('Extracted files:');
    function walk(dir) {
      const arr = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const p = dir + '/' + it.name;
        if (it.isDirectory()) arr.push(...walk(p)); else arr.push(p);
      }
      return arr;
    }
    const allFiles = walk(outDir);
    allFiles.forEach(f => console.log(' -', f));
    // Print any job log files that contain 'generate-sitemap-news' or 'sitemap' or the job name
    const candidates = allFiles.filter(f => /sitemap|generate-sitemap-news|call sitemap/i.test(f));
    if (candidates.length === 0) {
      console.log('No candidate log files matched keywords; printing top-level files instead.');
      // print the first 10 files
      const toShow = allFiles.slice(0, 10);
      for (const f of toShow) {
        console.log('\n==== FILE:', f, '====\n');
        try { console.log(fs.readFileSync(f, 'utf8').slice(0, 20000)); } catch(e){ console.error('read failed', e.message); }
      }
      process.exit(0);
    }
    for (const f of candidates) {
      console.log('\n==== MATCHED LOG FILE:', f, '====\n');
      try { console.log(fs.readFileSync(f, 'utf8')); } catch(e){ console.error('read failed', e.message); }
    }
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error', e);
    process.exit(5);
  }
})();
