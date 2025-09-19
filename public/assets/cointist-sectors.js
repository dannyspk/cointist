// cointist-sectors.js — sector-weighted indices (near real-time via polling)
(function(){
  const VS = 'usd';
  const POLL_MS = 90000; // 90s (CoinGecko free API friendly)
  // Use the serverless proxy endpoint on this deployment to avoid CORS / rate-limit issues
  // Use explicit localhost port for local dev when the app runs on a different dev server port
  const API_PROXY = (function(){
    try{
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin + '/api/coingecko';
      }
    }catch(e){}
    return '/api/coingecko';
  })();

  const SECTORS = {
    "Layer 1": { color: "#60a5fa", ids: ["bitcoin","ethereum","solana","cardano","avalanche-2"] },
    "Layer 2": { color: "#34d399", ids: ["arbitrum","optimism","polygon-ecosystem-token"] },
    "DeFi": { color: "#a78bfa", ids: ["uniswap","lido-dao","aave","maker","curve-dao-token","synthetix-network-token"] },
    "Exchange": { color: "#f59e0b", ids: ["binancecoin","crypto-com-chain","okb","huobi-token"] },
    "Oracles / Infra": { color: "#22d3ee", ids: ["chainlink","the-graph","filecoin"] },
    "Stablecoins": { color: "#94a3b8", ids: ["tether","usd-coin","dai"] }
  };

  const container = document.querySelector('[data-ct-sectors]');
  if(!container) return;
  container.innerHTML = renderSkeleton();

  async function fetchData(ids){
    // Construct the CoinGecko path and call the proxy
    const path = `coins/markets?vs_currency=${VS}&ids=${ids.join(',')}&price_change_percentage=24h`;
    const proxyUrl = API_PROXY + '?url=' + encodeURIComponent(path);
    const res = await fetch(proxyUrl, { headers: { 'accept': 'application/json' } });
    if(!res.ok) throw new Error('Price API error ' + res.status);
    return await res.json();
  }

  function computeSector(data, ids){
    let mcapSum = 0, weighted = 0;
    ids.forEach(id => {
      const c = data.find(x => x.id === id);
      if(!c) return;
      const m = c.market_cap || 0;
      const p = c.price_change_percentage_24h || 0;
      mcapSum += m;
      weighted += m * p;
    });
    const pct = mcapSum ? (weighted / mcapSum) : 0;
    return { pct, mcap: mcapSum };
  }

  function fmtPct(x){ return (x>=0?'+':'') + x.toFixed(2) + '%'; }
  function humanMcap(x){
    if(x>=1e12) return (x/1e12).toFixed(2)+'T';
    if(x>=1e9) return (x/1e9).toFixed(2)+'B';
    if(x>=1e6) return (x/1e6).toFixed(2)+'M';
    return x.toFixed(0);
  }

  async function update(){
    try{
      const allIds = Array.from(new Set(Object.values(SECTORS).flatMap(s => s.ids)));
      const data = await fetchData(allIds);
      let html = '<h3>Sector Indices</h3>';
      for(const [name, cfg] of Object.entries(SECTORS)){
        const { pct, mcap } = computeSector(data, cfg.ids);
        const up = pct >= 0;
        html += `
          <div class="ct-sec">
            <div class="name">
              <span class="badge" style="background:${cfg.color}"></span>
              <strong>${name}</strong>
              <span class="ct-small">· ${humanMcap(mcap)}</span>
            </div>
            <div class="val"><span class="chg ${up?'up':'down'}">${fmtPct(pct)}</span></div>
          </div>`;
      }
      html += '<div class="ct-small">Weighted by sector market cap · updates ~90s</div>';
      container.innerHTML = html;
    }catch(e){
      container.innerHTML = '<div class="ct-small">Index unavailable. Retrying…</div>';
      console.error(e);
    }
  }

  function renderSkeleton(){
    return '<h3>Sector Indices</h3>' + 
      Object.keys(SECTORS).map(name => `
        <div class="ct-sec">
          <div class="name"><span class="badge" style="background:#555"></span><strong>${name}</strong></div>
          <div class="val"><span class="ct-small">—</span></div>
        </div>`).join('') +
      '<div class="ct-small">Loading…</div>';
  }

  update();
  setInterval(update, POLL_MS);
})();