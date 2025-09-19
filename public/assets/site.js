/* Combined inline scripts moved from index.html
   Runs after DOMContentLoaded. External libs (Chart.js) must be loaded before this file.
*/
(function(){
  'use strict';
  // API proxy helper: use explicit localhost port when running locally to match dev server
  function getApiProxy(){
    try{
      const host = window.location.hostname;
      // Use same-origin API route to avoid calling a different dev port which can trigger
      // Next.js duplicate-route warnings and 410 responses. This keeps requests on the
      // current host/port (works in production and dev) and falls back to a relative path.
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin + '/api/coingecko';
      }
    }catch(e){}
    return '/api/coingecko';
  }
  function __cointist_init(){
    // --- Dynamic Sector Card Integration ---
    const SECTORS = [
      { name: "L1 Majors", desc: "Top 3 tokens", ids: ["bitcoin","ethereum","solana","binancecoin","avalanche-2"] },
      { name: "DeFi Bluechips", desc: "Top 3 tokens", ids: ["uniswap","aave","maker","curve-dao-token","compound-governance-token"] },
      { name: "Oracles", desc: "Top 3 tokens", ids: ["chainlink","band-protocol","api3"] },
      { name: "L2 / Scaling", desc: "Top 3 tokens", ids: ["arbitrum","optimism","polygon","starknet"] },
      { name: "Stablecoins", desc: "Top 3 tokens", ids: ["tether","usd-coin","dai","frax"] },
      { name: "AI & Big Data", desc: "Top 3 tokens", ids: ["fetch-ai","render-token","singularitynet","ocean-protocol"] },
      { name: "Gaming", desc: "Top 3 tokens", ids: ["immutable-x","axie-infinity","the-sandbox","decentraland"] },
      { name: "Privacy", desc: "Top 3 tokens", ids: ["monero","zcash","secret"] },
      { name: "NFT", desc: "Top 3 tokens", ids: ["apecoin","blur","decentraland"] },
      { name: "DEX", desc: "Top 3 tokens", ids: ["uniswap","curve-dao-token","sushiswap","balancer"] },
      { name: "Liquid Staking", desc: "Top 3 tokens", ids: ["lido-dao","rocket-pool","frax-ether"] },
      { name: "RWA", desc: "Top 3 tokens", ids: ["pendle","centrifuge","polymesh"] },
    ];

    const sectorCard = document.getElementById('sector-card');
    const sectorName = document.getElementById('sector-name');
    const sectorDesc = document.getElementById('sector-desc');
    const sectorValue = document.getElementById('sector-value');
    const sectorChange = document.getElementById('sector-change');
    const sectorSparkline = document.getElementById('sector-sparkline-path');
    const sectorSparkFill = document.getElementById('sector-sparkline-fill');
    const sectorAssets = document.getElementById('sector-assets');
    const prevBtn = document.getElementById('sector-prev');
    const nextBtn = document.getElementById('sector-next');

    let currentSector = 0;
    let sectorData = Array(SECTORS.length).fill(null);
    let lastRefresh = 0;
    const REFRESH_INTERVAL = 120000;

    function fNum(n){ return n>=1e12?(n/1e12).toFixed(2)+'T' : n>=1e9?(n/1e9).toFixed(2)+'B' : n>=1e6?(n/1e6).toFixed(2)+'M' : n>=1e3?(n/1e3).toFixed(2)+'K' : n.toFixed(0); }

    function computeSnapshot(mkts){
      const totalMC = mkts.reduce((s,c)=> s + (c.market_cap||0), 0);
      if (!totalMC) return { change:0, value:'$0', weights:{}, assets:[] };
      const weights = Object.fromEntries(mkts.map(c => [c.id, (c.market_cap||0)/totalMC]));
      let change = 0; for (const c of mkts){ const w = weights[c.id]||0; const ch = c.price_change_percentage_24h||0; change += w * ch; }
      const assets = mkts.map(c => ({ name:c.name, symbol:c.symbol.toUpperCase(), icon:c.image, weight:(weights[c.id]*100).toFixed(1), price:c.current_price, change:c.price_change_percentage_24h })).sort((a,b)=>b.weight-a.weight).slice(0,3);
      return { change, value:'$'+fNum(totalMC), weights, assets };
    }

    function buildSectorSeries(mkts, weights){
      if (!mkts.length) return [];
      const len = Math.min(...mkts.map(c => (c.sparkline_in_7d?.price||[]).length)) || 0;
      if (!len) return [];
      return Array.from({length: len}, (_, i) => {
        let sum = 0;
        for (const c of mkts){
          const arr = c.sparkline_in_7d.price;
          const base = arr[0] || 1;
          const norm = base ? (arr[i] / base) : 1;
          sum += (weights[c.id]||0) * norm;
        }
        return sum * 100;
      });
    }

    function sparkPath(values, w, h, pad=2){
      if (!values.length) return { line:'', area:'' };
      const min = Math.min(...values), max = Math.max(...values), span = (max-min)||1;
      const innerW = w - pad*2, innerH = h - pad*2;
      const pts = values.map((v,i)=>[ pad + (i/(values.length-1))*innerW, pad + innerH - ((v-min)/span)*innerH ]);
      const line = 'M ' + pts.map(p=>p.join(' ')).join(' L ');
      const area = line + ` L ${pad+innerW} ${pad+innerH} L ${pad} ${pad+innerH} Z`;
      return { line, area };
    }

    function renderSector(idx){
      if(!sectorName) return; // safety
      const sector = SECTORS[idx];
      const data = sectorData[idx];
      sectorName.textContent = sector.name; sectorDesc.textContent = sector.desc;
      if (!data){ sectorValue.textContent = '…'; sectorChange.textContent = ''; sectorAssets.innerHTML = '<div class="loading">Loading…</div>'; if(sectorSparkline) sectorSparkline.setAttribute('d',''); if(sectorSparkFill) sectorSparkFill.setAttribute('d',''); return; }
      sectorValue.textContent = data.value; sectorChange.textContent = (data.change>=0?'+':'')+data.change.toFixed(2)+'%'; sectorChange.style.color = data.change>=0 ? '#14f195' : '#ff4e4e';
      const series = data.series||[]; const { line, area } = sparkPath(series, 160, 48, 3); if(sectorSparkline) sectorSparkline.setAttribute('d',line); if(sectorSparkFill) sectorSparkFill.setAttribute('d',area);
  sectorAssets.innerHTML = data.assets.map(a=>`<div class="sector-row"><span class="sector-row-left"><img src="${a.icon}" alt="${a.name || a.symbol || 'asset logo'}"/> <strong>${a.name}</strong> <span class="symbol">${a.symbol}</span></span><span class="sector-row-right">${a.weight}%</span></div>`).join('');
    }

    async function fetchSector(idx){
      const sector = SECTORS[idx];
  const proxyUrl = `${getApiProxy()}?url=${encodeURIComponent(`coins/markets?vs_currency=usd&ids=${sector.ids.join(',')}&sparkline=true&price_change_percentage=24h&per_page=${sector.ids.length}`)}`;
      try {
        const res = await fetch(proxyUrl);
        let mkts = await res.json();
        if (!Array.isArray(mkts)) mkts = Object.values(mkts);
        const snap = computeSnapshot(mkts); snap.series = buildSectorSeries(mkts, snap.weights); sectorData[idx] = snap; renderSector(idx);
      } catch(e){ sectorData[idx] = null; renderSector(idx); }
    }

    function showSector(idx){
      currentSector = ((idx%SECTORS.length)+SECTORS.length)%SECTORS.length;
      const now = Date.now();
      if (!sectorData[currentSector] || (now - lastRefresh > REFRESH_INTERVAL)) { fetchSector(currentSector); lastRefresh = now; } else { renderSector(currentSector); }
    }

    prevBtn?.addEventListener('click', ()=> showSector(currentSector-1)); nextBtn?.addEventListener('click', ()=> showSector(currentSector+1));
    // Auto-loop
    let autoLoop;
    function startAutoLoop(){ if (autoLoop) clearInterval(autoLoop); autoLoop = setInterval(()=> showSector(currentSector+1), 6000); }
    function stopAutoLoop(){ if (autoLoop) clearInterval(autoLoop); }
    sectorCard?.addEventListener('mouseenter', stopAutoLoop); sectorCard?.addEventListener('mouseleave', startAutoLoop);
    startAutoLoop();

    const sectorIndicators = document.getElementById('sector-indicators');
    function renderSectorIndicators(){ if(!sectorIndicators) return; sectorIndicators.innerHTML=''; for(let i=0;i<SECTORS.length;i++){ const dot=document.createElement('span'); dot.style.width='10px'; dot.style.height='10px'; dot.style.borderRadius='50%'; dot.style.background = i===currentSector? '#14f195':'#23292a'; dot.style.border='1.5px solid #14f195'; dot.style.display='inline-block'; dot.style.cursor='pointer'; dot.addEventListener('click', ()=> showSector(i)); sectorIndicators.appendChild(dot); } }
    const _showSector = showSector; showSector = function(idx){ _showSector(idx); renderSectorIndicators(); }
    showSector(0); renderSectorIndicators();

    // --- market + sectors fetch (CoinGecko) ---
    let sharedMarketData = null;
    const marqueeIds = ['bitcoin','ethereum','solana','binancecoin','avalanche-2','cardano','matic-network','polkadot','chainlink','arbitrum','ripple','dogecoin','tron','hyperliquid','injective'];
    const marqueeSymbols = { bitcoin:'BTC', ethereum:'ETH', solana:'SOL', binancecoin:'BNB', 'avalanche-2':'AVAX', cardano:'ADA', 'matic-network':'MATIC', polkadot:'DOT', chainlink:'LINK', arbitrum:'ARB', ripple:'XRP', dogecoin:'DOGE', tron:'TRX', hyperliquid:'HL', injective:'INJ' };
    const marqueeLogos = { BTC:'/assets/bitcoin-btc-logo.webp', ETH:'/assets/ethereum-eth-logo.webp', SOL:'/assets/solana-sol-logo.webp', BNB:'/assets/binance-bnb-logo.webp', AVAX:'/assets/avalanche-avax-logo.webp', ADA:'/assets/cardano-ada-logo.webp', MATIC:'/assets/polygon-matic-logo.webp', DOT:'/assets/polkadot-dot-logo.webp', LINK:'/assets/chainlink-link-logo.webp', ARB:'/assets/arbitrum-arb-logo.webp', XRP:'/assets/xrp-xrp-logo.webp', DOGE:'/assets/dogecoin-doge-logo.webp', TRX:'assets/tron-logo.webp', HL:'/assets/lightlogo.webp', INJ:'assets/injective-logo.webp' };

    async function fetchAllMarketData(){
      const allIds = Array.from(new Set([ ...marqueeIds, ...SECTORS.flatMap(s=>s.ids) ]));
  const proxyUrl = `${getApiProxy()}?url=${encodeURIComponent(`coins/markets?vs_currency=usd&ids=${allIds.join(',')}&sparkline=true&price_change_percentage=24h&per_page=${allIds.length}`)}`;
      try{ const res=await fetch(proxyUrl); let data=await res.json(); if(!Array.isArray(data)) data=Object.values(data); sharedMarketData=data; updateMarketMarquee(); updateAllSectors(); } catch(e){ sharedMarketData=null; updateMarketMarquee(); updateAllSectors(); }
    }

    function updateMarketMarquee(){
      let html='';
      if(!sharedMarketData || !Array.isArray(sharedMarketData) || sharedMarketData.length===0){
        html = '<span style="color:#bbb;font-size:1em;">Loading market data...</span>'; 
      } else {
        marqueeIds.forEach(id => {
          const sym = marqueeSymbols[id];
          let item = sharedMarketData.find(x => x.id === id);
          // Prefer CoinGecko image when available, otherwise use local mapping or a default
          const logoUrl = (item && item.image) ? item.image : (marqueeLogos[sym] ? marqueeLogos[sym] : '/assets/lightlogo.webp');
          if (item && sym) {
            const price = item.current_price?.toLocaleString('en-US', { maximumFractionDigits: 6 });
            const change = item.price_change_percentage_24h ?? 0;
            const up = change >= 0;
            html += `<span><img class="coin-logo" src="${logoUrl}" alt="${sym}"> ${sym} $${price} <span class="delta ${up ? 'up' : 'down'}">${up ? '+' : ''}${change.toFixed(2)}%</span></span>`;
          }
        });
        if(!html) html = '<span style="color:#bbb;font-size:1em;">Loading market data...</span>';
      }
  // Write into a single canonical marquee. Prefer an element marked as data-primary,
  // otherwise use the first .market-marquee found. This avoids duplicate tickers when
  // multiple pages/components render the <MarketMarquee /> component.
  const primaryEl = document.querySelector('.market-marquee[data-primary="true"]') || document.querySelector('.market-marquee');
  if (primaryEl) { primaryEl.innerHTML = html; }
    }

    function updateAllSectors(){ SECTORS.forEach((sector, idx)=>{ const mkts = sharedMarketData ? sharedMarketData.filter(x=>sector.ids.includes(x.id)) : []; const snap = computeSnapshot(mkts); snap.series = buildSectorSeries(mkts, snap.weights); sectorData[idx] = snap; renderSector(idx); }); }

    // fetch on load
    fetchAllMarketData();

    // Legacy carousel initialization removed: React controls the `.carousel-track` on the
    // homepage. Leaving this block as a no-op prevents the legacy script from double-driving
    // transforms and interfering with React's animation/timing.
    (function(){
      // noop - legacy carousel disabled in favor of React implementation
      try{ if (window && window.console && window.console.debug) window.console.debug('[site.js] legacy carousel disabled - React controls .carousel-track') }catch(e){}
    })();

  // Featured scroller initialization disabled to avoid conflicts with React-managed components.
  (function(){ try{ if (window && window.console && window.console.debug) window.console.debug('[site.js] legacy featured scroller disabled') }catch(e){} })();

    // Sparkline Chart.js setup (runs after Chart.js loaded)
    (function(){ try{
      const sparklineData = { 'defi':[12,14,13,15,16,17,18],'l1':[210,208,212,211,210,209,208],'ai':[8,9,10,11,12,13,12],'gaming':[6,7,7,8,8,8,9],'stablecoins':[130,131,130,129,130,130,129],'nft':[2,2.5,2.7,2.8,2.9,3,3] };
      const sectorIds = ['defi','l1','ai','gaming','stablecoins','nft'];
      sectorIds.forEach(function(sector){ const el = document.getElementById('sparkline-'+sector); if(!el) return; if(typeof Chart === 'undefined') return; new Chart(el, { type:'line', data:{ labels:Array(sparklineData[sector].length).fill(''), datasets:[{ data:sparklineData[sector], borderColor: sector==='l1' || sector==='stablecoins' ? '#ff4e4e' : '#14f195', backgroundColor:'rgba(20,241,149,0.08)', borderWidth:2, pointRadius:0, fill:false, tension:0.5 }] }, options:{ responsive:false, plugins:{ legend:{ display:false } }, scales:{ x:{ display:false }, y:{ display:false } }, elements:{ line:{ borderCapStyle:'round' } }, animation:false } }); });
    }catch(e){/*ignore*/} })();

    // Mobile menu open/close logic (robust version)
    (function(){ const openBtn = document.querySelector('[data-menu-open]') || document.getElementById('mobileMenuOpen'); const closeBtnSel = '[data-menu-close]'; const menu = document.getElementById('mobile-menu'); if(!menu || !openBtn) return; const panel = menu.querySelector('.mobile-menu__panel'); function open(){ menu.classList.add('is-open'); document.body.classList.add('menu-open'); menu.setAttribute('aria-hidden','false'); setTimeout(()=> menu.querySelector(closeBtnSel)?.focus(), 0); } function close(){ menu.classList.remove('is-open'); document.body.classList.remove('menu-open'); menu.setAttribute('aria-hidden','true'); openBtn.focus(); } openBtn.addEventListener('click', open); menu.addEventListener('click', (e)=>{ if(e.target===menu) close(); }); menu.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); }); menu.querySelector(closeBtnSel)?.addEventListener('click', close); })();

    // Subscribe smooth scroll
    document.querySelectorAll('.subscribe-btn').forEach(function(btn){ btn.addEventListener('click', function(e){ e.preventDefault(); const sub = document.getElementById('subscribe'); if(sub) sub.scrollIntoView({ behavior:'smooth' }); }); });

    // Defensive mobile menu ID listeners (if present)
    try{ const mobileMenuOpenEl = document.getElementById('mobileMenuOpen'); const mobileMenuEl = document.getElementById('mobileMenu'); const mobileMenuCloseEl = document.getElementById('mobileMenuClose'); if(mobileMenuOpenEl && mobileMenuEl){ mobileMenuOpenEl.addEventListener('click', ()=>{ mobileMenuEl.classList.add('active'); document.body.style.overflow='hidden'; }); } if(mobileMenuCloseEl && mobileMenuEl){ mobileMenuCloseEl.addEventListener('click', ()=>{ mobileMenuEl.classList.remove('active'); document.body.style.overflow=''; }); } }catch(e){/*ignore*/}

  }

  // Run init now if DOM already loaded, otherwise wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __cointist_init);
  } else {
    __cointist_init();
  }
})();
