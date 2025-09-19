// cointist-live-prices.js — Live prices via CoinCap WebSocket with REST fallback
(function(){
  const SEL = '[data-ct-live]';
  const ATTR = 'data-ct-assets'; // comma-separated list of coincap IDs
  const WS_URL = (assets) => `wss://ws.coincap.io/prices?assets=${encodeURIComponent(assets.join(','))}`;
  const REST_URL = (assets) => `https://api.coincap.io/v2/assets?ids=${encodeURIComponent(assets.join(','))}`;

  const container = document.querySelector(SEL);
  if(!container) return;

  const assets = (container.getAttribute(ATTR) || 'bitcoin,ethereum,solana')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const LABELS = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL',
    tether: 'USDT', 'usd-coin': 'USDC', cardano: 'ADA',
    binancecoin: 'BNB', xrp: 'XRP', 'staked-ether': 'stETH'
  };

  // Skeleton
  const rowsEl = document.createElement('div');
  rowsEl.className = 'rows';
  container.innerHTML = '<h3>Live Prices <span class="src">via CoinCap</span></h3>';
  container.appendChild(rowsEl);
  const tsEl = document.createElement('div');
  tsEl.className = 'ts';
  tsEl.textContent = 'Connecting…';
  container.appendChild(tsEl);

  const rowFor = {};
  assets.forEach(id => {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = id;
    row.innerHTML = `<div class="sym"><strong>${(LABELS[id]||id).toUpperCase()}</strong></div><div class="p">—</div>`;
    rowsEl.appendChild(row);
    rowFor[id] = row;
  });

  let ws, raf=null, queue={}, restTimer=null, reconnectTimer=null;
  let usingREST = false;

  function setStatus(msg){ tsEl.textContent = msg; }

  function render(){
    for(const id in queue){
      const price = parseFloat(queue[id]);
      const row = rowFor[id];
      if(!row || !isFinite(price)) continue;
      const el = row.querySelector('.p');
      const prev = parseFloat((el.textContent || '').replace(/,/g,''));
      el.textContent = Number(price).toLocaleString(undefined,{maximumFractionDigits:2});
      row.classList.toggle('up', isFinite(prev) && price > prev);
      row.classList.toggle('down', isFinite(prev) && price < prev);
    }
    queue = {}; raf = null;
    setStatus((usingREST?'Updated (REST) ':'Updated ') + new Date().toLocaleTimeString());
  }

  async function pollREST(){
    try{
      const res = await fetch(REST_URL(assets), { headers: { 'accept': 'application/json' } });
      if(!res.ok) throw new Error('REST error '+res.status);
      const { data } = await res.json();
      data.forEach(d => { queue[d.id] = d.priceUsd; });
      if(!raf) raf = requestAnimationFrame(render);
    }catch(e){
      setStatus('REST error — retrying…');
      console.error(e);
    }
  }

  function startREST(){
    usingREST = true;
    if(restTimer) clearInterval(restTimer);
    pollREST();
    restTimer = setInterval(pollREST, 5000); // 5s poll as fallback
  }

  function stopREST(){
    usingREST = false;
    if(restTimer) { clearInterval(restTimer); restTimer=null; }
  }

  function connectWS(){
    try{
      ws = new WebSocket(WS_URL(assets));
    }catch(e){
      console.error(e);
      setStatus('WebSocket unsupported — using REST fallback');
      startREST();
      return;
    }
    ws.onopen = () => { setStatus('Live (WebSocket)'); stopREST(); };
    ws.onmessage = (e) => {
      try{
        const data = JSON.parse(e.data);
        Object.assign(queue, data);
        if(!raf) raf = requestAnimationFrame(render);
      }catch(err){ console.error('Parse error', err); }
    };
    ws.onerror = () => { setStatus('WS error — fallback to REST'); startREST(); };
    ws.onclose = () => {
      setStatus('WS disconnected — fallback to REST, reconnecting…');
      startREST();
      if(reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWS, 3000 + Math.random()*2000);
    };
  }

  // Don’t auto-close on hidden; keep it simple/robust
  connectWS();
})();
