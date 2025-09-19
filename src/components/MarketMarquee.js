import React, { useEffect, useState } from 'react';
import Image from 'next/image'

const MARQUEE_IDS = ['bitcoin','ethereum','solana','binancecoin','avalanche-2','cardano','matic-network','polkadot','chainlink','arbitrum','ripple','dogecoin','tron','hyperliquid'];
const MARQUEE_SYMBOLS = { bitcoin:'BTC', ethereum:'ETH', solana:'SOL', binancecoin:'BNB', 'avalanche-2':'AVAX', cardano:'ADA', 'matic-network':'MATIC', polkadot:'DOT', chainlink:'LINK', arbitrum:'ARB', ripple:'XRP', dogecoin:'DOGE', tron:'TRX', hyperliquid:'HL' };
const MARQUEE_LOGOS = { BTC:'/assets/bitcoin-btc-logo.webp', ETH:'/assets/ethereum-eth-logo.webp', SOL:'/assets/solana-sol-logo.webp', BNB:'/assets/binance-bnb-logo.webp', AVAX:'/assets/avalanche-avax-logo.webp', ADA:'/assets/cardano-ada-logo.webp', MATIC:'/assets/polygon-matic-logo.webp', DOT:'/assets/polkadot-dot-logo.webp', LINK:'/assets/chainlink-link-logo.webp', ARB:'/assets/arbitrum-arb-logo.webp', XRP:'/assets/xrp-xrp-logo.webp', DOGE:'/assets/dogecoin-doge-logo.webp', TRX:'/assets/tron-logo.webp', HL:'/assets/lightlogo.webp', INJ:'/assets/injective-logo.webp' };

export default function MarketMarquee() {
  const [items, setItems] = useState([]);

  const normalizeSrc = (s) => {
    if (!s) return s
    try{ if (/^https?:\/\//i.test(s)) return s }catch(e){}
    return s.startsWith('/') ? s : `/${s}`
  }

  useEffect(() => {
    let mounted = true;

    async function fetchMarkets(){
      try{
        const allIds = Array.from(new Set(MARQUEE_IDS));
        const qs = `coins/markets?vs_currency=usd&ids=${allIds.join(',')}&sparkline=false&price_change_percentage=24h&per_page=${allIds.length}`;
        const url = `/api/coingecko?url=${encodeURIComponent(qs)}`;
        const res = await fetch(url);
        let data = await res.json();
        if(!Array.isArray(data)) data = Object.values(data || {});
        if(!mounted) return;
        const mapped = MARQUEE_IDS.map(id => {
          const entry = data.find(d => d.id === id);
          const sym = MARQUEE_SYMBOLS[id];
          const logo = (entry && entry.image) ? entry.image : (MARQUEE_LOGOS[sym] || '/assets/lightlogo.webp');
          const price = entry?.current_price ?? null;
          const change = entry?.price_change_percentage_24h ?? 0;
          return { id, sym, logo, price, change };
        }).filter(Boolean);
        setItems(mapped);
      }catch(e){ setItems([]); }
    }

    fetchMarkets();
    const iv = setInterval(fetchMarkets, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <div className="market-marquee-wrap">
      <div className="market-marquee">
        {items.length === 0 && <span style={{color:'#bbb', fontSize:'1em'}}>Loading market data...</span>}
        {items.map(it => (
          <span key={it.id} className="marquee-item">
            <Image className="coin-logo" src={normalizeSrc(it.logo)} alt={it.sym} width={20} height={20} />
            <strong style={{marginLeft:6, marginRight:6}}>{it.sym}</strong>
            {it.price != null ? (`$${Number(it.price).toLocaleString('en-US', { maximumFractionDigits: 6 })}`) : ''}
            <span className={`delta ${it.change >= 0 ? 'up' : 'down'}`} style={{marginLeft:8}}>{it.change >= 0 ? '+' : ''}{Number(it.change).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
