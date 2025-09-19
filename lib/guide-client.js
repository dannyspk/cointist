// Client-side enhancements for guide pages: scrollspy + cards thumb
export function init(){
  try{
    // Scrollspy
    (function(){
      if (typeof window === 'undefined') return;
      function initScrollSpy(){
        try{
          const MOBILE_HIDE_TOC = 900;
          if (typeof window !== 'undefined' && window.innerWidth <= MOBILE_HIDE_TOC) {
            try{
              if (window.__cointist_scrollspy && window.__cointist_scrollspy._createdToc){
                const created = document.querySelector('.toc');
                if (created && created.parentElement){ created.parentElement.removeChild(created); }
                delete window.__cointist_scrollspy._createdToc;
              }
            }catch(e){}
          }

          let toc = document.querySelector('.toc');
          // Only select true heading elements inside the article. Previously we
          // used a broad selector (article [id]) which picked up paragraphs or
          // other nodes with ids (e.g. intro paragraphs), causing the TOC to
          // show full section text. Restrict to h2/h3 with ids so the TOC
          // contains only headings.
          const headingEls = Array.from(document.querySelectorAll('article h2[id], article h3[id]'))
            .filter(Boolean)
            .filter((el, idx, arr) => arr.indexOf(el) === idx)
            .filter(el => el.id && el.closest('article'));

          if(!toc){
            try{
              toc = document.createElement('aside');
              toc.className = 'toc';
              toc.setAttribute('aria-label', 'On this page');
              const h4 = document.createElement('h4'); h4.textContent = 'On this page'; toc.appendChild(h4);
              const ol = document.createElement('ol'); toc.appendChild(ol);
              const grid = document.querySelector('.grid');
              if(grid){ grid.appendChild(toc); }
              window.__cointist_scrollspy = window.__cointist_scrollspy || {};
              window.__cointist_scrollspy._createdToc = true;
            }catch(e){}
          }

          const ol = toc && toc.querySelector('ol');
          if(ol && (!ol.children || ol.children.length === 0)){
            let lastLi = null;
            headingEls.forEach(el => {
              const tag = (el.tagName || '').toLowerCase();
              const id = el.id;
              const title = (el.textContent || id).trim();
              if(!id) return;
              if(tag === 'h3' && lastLi){
                let sub = lastLi.querySelector('ol.sub');
                if(!sub){ sub = document.createElement('ol'); sub.className = 'sub'; lastLi.appendChild(sub); }
                const li = document.createElement('li');
                const a = document.createElement('a'); a.href = '#'+id; a.textContent = title; li.appendChild(a); sub.appendChild(li);
              } else {
                const li = document.createElement('li');
                const a = document.createElement('a'); a.href = '#'+id; a.textContent = title; li.appendChild(a); ol.appendChild(li); lastLi = li;
              }
            });
          }

          const links = toc ? Array.from(toc.querySelectorAll('a[href^="#"]')) : [];
          const idToLink = new Map();
          links.forEach(l => {
            const href = l.getAttribute('href') || '';
            const id = href.replace('#','');
            if(id) idToLink.set(id, l);
            l.addEventListener('click', function(e){ e.preventDefault(); const target = document.getElementById(id); if(target){ target.scrollIntoView({behavior:'smooth', block:'center'}); history.replaceState && history.replaceState(null,'', '#'+id); } });
          });

          const observed = headingEls.map(el => el).filter(Boolean);

          if (!observed.length){
            window.__cointist_scrollspy_retry = (window.__cointist_scrollspy_retry || 0) + 1;
            if(window.__cointist_scrollspy_retry <= 6){
              setTimeout(initScrollSpy, 250);
              return;
            }
          }

          let activeId = null;
          let obs = null;
          try{
            obs = new IntersectionObserver((entries)=>{
              const visible = entries.filter(en=>en.isIntersecting).sort((a,b)=>b.intersectionRatio - a.intersectionRatio);
              let id = null;
              if(visible.length){ id = visible[0].target.id }
              else {
                const above = entries.filter(en=>en.boundingClientRect.top < 0).sort((a,b)=>b.boundingClientRect.top - a.boundingClientRect.top);
                if(above.length) id = above[0].target.id
              }
              if(id && id !== activeId){
                activeId = id;
                idToLink.forEach((lnk, key)=>{ if(key === id) lnk.classList.add('active'); else lnk.classList.remove('active'); });
              }
            }, { root: null, rootMargin: '-35% 0px -45% 0px', threshold: [0.1,0.4,0.6,0.9] });
          }catch(e){}

          if(obs && observed.length){ observed.forEach(el=>obs.observe(el)); }
          else {
            function nearestHighlight(){
              try{
                const coords = observed.map(el=>({ id: el.id, top: Math.abs(el.getBoundingClientRect().top) }));
                if(!coords.length) return;
                coords.sort((a,b)=>a.top - b.top);
                const nearest = coords[0] && coords[0].id;
                if(nearest && nearest !== activeId){ activeId = nearest; idToLink.forEach((lnk, key)=>{ if(key === nearest) lnk.classList.add('active'); else lnk.classList.remove('active'); }); }
              }catch(e){}
            }
            nearestHighlight();
            window.addEventListener('scroll', nearestHighlight, { passive: true });
            const prevDisconnect = window.__cointist_scrollspy && window.__cointist_scrollspy.disconnect;
            window.__cointist_scrollspy = window.__cointist_scrollspy || {};
            window.__cointist_scrollspy.disconnect = function(){ try{ window.removeEventListener('scroll', nearestHighlight); prevDisconnect && prevDisconnect(); }catch(e){} };
          }

          setTimeout(()=>{
            const h = (location.hash || '').replace('#','');
            if(h && idToLink.has(h)){ idToLink.get(h).classList.add('active'); }
          }, 50);

          window.__cointist_scrollspy = { disconnect: ()=>{ try{ obs && obs.disconnect(); }catch(e){} } };

          function ancestorBlocksSticky(el){
            try{
              let p = el.parentElement;
              while(p && p !== document.body){
                const cs = window.getComputedStyle(p);
                if (cs && cs.transform && cs.transform !== 'none') return true;
                const ov = (cs.overflow + ' ' + cs.overflowY + ' ' + cs.overflowX).toLowerCase();
                if (ov.includes('hidden') || ov.includes('scroll') || ov.includes('auto')) return true;
                p = p.parentElement;
              }
            }catch(e){}
            return false;
          }

          function applyFixedFallback(){
            try{
              const toc = document.querySelector('.toc');
              if(!toc) return;
              const rect = toc.getBoundingClientRect();
              const comp = window.getComputedStyle(toc);
              const blocked = ancestorBlocksSticky(toc);
              let top = 259;
              let tocWidth = rect.width || 300;
              let rightInset = 12;
              const grid = document.querySelector('.grid');
              const def = document.querySelector('.definition');
              const header = document.querySelector('header') || document.querySelector('.topbar');
              const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0;
              if (grid){
                try{
                  const g = grid.getBoundingClientRect();
                  const gcs = window.getComputedStyle(grid);
                  const cols = (gcs.gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean);
                  const isSingleColumn = cols.length < 2;
                  let rightColWidth = 320;
                  const last = cols[cols.length - 1] || '';
                  const pxMatch = (last && last.match) ? last.match(/(\d+)px/) : null;
                  if (pxMatch) rightColWidth = parseFloat(pxMatch[1]);
                  tocWidth = Math.max(200, Math.min(rightColWidth - 24, 360));
                  const gridRight = Math.round(g.left + g.width);
                  rightInset = Math.max(12, Math.round(window.innerWidth - gridRight) + 12);
                  if (!isSingleColumn && def){
                    try{
                      const d = def.getBoundingClientRect();
                      top = Math.max(headerBottom + 12, Math.round(d.top));
                    }catch(e){ top = Math.max(headerBottom + 12, 24); }
                  } else {
                    top = Math.max(headerBottom + 12, 24);
                  }
                }catch(e){}
              } else {
                top = Math.max(headerBottom + 12, 24);
              }

              let shouldFix = blocked;
              // prefer explicit #why-now anchor, otherwise fall back to the first heading found on the page
              let startEl = document.getElementById('why-now') || (headingEls && headingEls[0]) || null;
              const pageYOffset = window.pageYOffset || document.documentElement.scrollTop || 0;
              const startPageTop = startEl ? Math.round((startEl.getBoundingClientRect().top || 0) + pageYOffset) : null;
              if (!shouldFix && startPageTop !== null){
                const triggerAt = Math.max(headerBottom + 12, startPageTop - 12);
                if ((window.pageYOffset || 0) >= (triggerAt - 8)){
                  shouldFix = true;
                }
              }

              // prefer an explicit #faq anchor, otherwise use the last heading in the article
              const lastHeading = (headingEls && headingEls.length) ? headingEls[headingEls.length - 1] : null;
              const endEl = document.getElementById('faq') || lastHeading;
              const startTop = startEl ? Math.round(startEl.getBoundingClientRect().top) : null;
              const endTop = endEl ? Math.round(endEl.getBoundingClientRect().top) : null;
              // use the bottom of the end element so the TOC hides after the last item has finished
              const endPage = endEl ? Math.round((endEl.getBoundingClientRect().bottom || 0) + pageYOffset) : null;
              if (endPage && pageYOffset > endPage) {
                toc.classList.remove('fixed');
                toc.style.display = 'none';
                toc.style.width = '';
                toc.style.right = '';
                toc.style.left = '';
                toc.style.top = '';
                toc.style.maxHeight = '';
                toc.style.overflowY = '';
                return;
              } else {
                toc.style.display = '';
              }

              const TOC_VERTICAL_NUDGE = 0;
              console.debug && console.debug('TOC fallback check', { toc: !!toc, startId: startEl ? startEl.id : null, blocked, rectTop: rect.top });
              const desiredTop = startTop ? Math.max(headerBottom + 12, startTop - TOC_VERTICAL_NUDGE) : Math.max(headerBottom + 12, top);
              const availablePx = endTop ? (endTop - desiredTop - 24) : (window.innerHeight - desiredTop - 24);
              const maxHeight = Math.max(160, Math.floor(availablePx));
              if(shouldFix){
                toc.style.width = tocWidth + 'px';
                toc.style.right = rightInset + 'px';
                toc.style.left = '';
                toc.style.top = desiredTop + 'px';
                toc.style.maxHeight = maxHeight + 'px';
                toc.style.overflowY = 'auto';
                toc.classList.add('fixed');
              } else {
                toc.classList.remove('fixed');
                toc.style.width = '';
                toc.style.right = '';
                toc.style.left = '';
                toc.style.top = '';
                toc.style.maxHeight = '';
                toc.style.overflowY = '';
              }
            }catch(e){}
          }

          applyFixedFallback();
          let _rf;
          function schedule(){ if(_rf) cancelAnimationFrame(_rf); _rf = requestAnimationFrame(applyFixedFallback); }
          window.addEventListener('resize', schedule);
          window.addEventListener('scroll', schedule, { passive: true });
          const _origCleanup = window.__cointist_scrollspy && window.__cointist_scrollspy.disconnect;
          window.__cointist_scrollspy = window.__cointist_scrollspy || { disconnect: function(){} };
          window.__cointist_scrollspy.disconnect = function(){ try{ _origCleanup && _origCleanup(); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule); if(window.__cointist_scrollspy && window.__cointist_scrollspy._createdToc){ try{ const t = document.querySelector('.toc'); t && t.parentElement && t.parentElement.removeChild(t); delete window.__cointist_scrollspy._createdToc; }catch(e){} } }catch(e){} };

        }catch(e){}
      }
      if(document.readyState === 'complete' || document.readyState === 'interactive') initScrollSpy(); else window.addEventListener('DOMContentLoaded', initScrollSpy);
      try{ window.addEventListener('load', function(){ setTimeout(initScrollSpy, 120); }); }catch(e){}
    })();

    // Cards scroller init + dynamic thumb
    (function(){
      if (typeof window === 'undefined') return;
      function initCards(){
        try{
          const track = document.querySelector('.cards-track');
          const prev = document.querySelector('.cards-prev');
          const next = document.querySelector('.cards-next');
          if(!track || !prev || !next) return;
          const card = track.querySelector('.learn-card');
          const gap = 18;
          const step = card ? (card.getBoundingClientRect().width + gap) : Math.floor(track.clientWidth * 0.7);
          prev.addEventListener('click', ()=>{ track.scrollBy({ left: -step, behavior: 'smooth' }); });
          next.addEventListener('click', ()=>{ track.scrollBy({ left: step, behavior: 'smooth' }); });

          // auto show/hide arrows & viewport when there's no overflow
          try{
            const viewport = document.querySelector('.cards-viewport');
            function updateOverflowVisibility(){
              try{
                const scrollWidth = track.scrollWidth || 0;
                const clientWidth = track.clientWidth || 0;
                const isOverflowing = scrollWidth > clientWidth + 1; // small tolerance
                if(isOverflowing){
                  prev.style.display = '';
                  next.style.display = '';
                  if(viewport) viewport.style.display = '';
                } else {
                  prev.style.display = 'none';
                  next.style.display = 'none';
                  if(viewport) viewport.style.display = 'none';
                }
                // also hide/show left arrow at left-most and right arrow at right-most
                if(isOverflowing){
                  const sl = track.scrollLeft || 0;
                  const maxScroll = Math.max(0, scrollWidth - clientWidth);
                  if(sl <= 4) prev.setAttribute('aria-hidden','true'); else prev.removeAttribute('aria-hidden');
                  if(sl >= maxScroll - 4) next.setAttribute('aria-hidden','true'); else next.removeAttribute('aria-hidden');
                } else {
                  prev.setAttribute('aria-hidden','true');
                  next.setAttribute('aria-hidden','true');
                }
              }catch(e){}
            }
            // initial check
            updateOverflowVisibility();
            // keep in sync on resize and scroll
            const _onResizeOverflow = function(){ try{ updateOverflowVisibility(); }catch(e){} };
            track.addEventListener('scroll', _onResizeOverflow, { passive: true });
            window.addEventListener('resize', _onResizeOverflow);
            // expose disconnect to cleanup path further down
            window.__cointist_cards = window.__cointist_cards || {};
            const prevDisconnect = window.__cointist_cards.disconnect;
            window.__cointist_cards.disconnect = function(){ try{ track.removeEventListener('scroll', _onResizeOverflow); window.removeEventListener('resize', _onResizeOverflow); prevDisconnect && prevDisconnect(); }catch(e){} };
          }catch(e){}
          try{
            const viewport = document.querySelector('.cards-viewport');
            if(viewport){
              const updateThumb = function(){
                try{
                  const scrollLeft = track.scrollLeft || 0;
                  const scrollWidth = track.scrollWidth || 0;
                  const clientWidth = track.clientWidth || 1;
                  const maxScroll = Math.max(1, scrollWidth - clientWidth);
                  const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
                  const leftPct = 8; const rightPct = 8;
                  const viewRatio = clientWidth / scrollWidth || 0.15;
                  const thumbWidthPct = Math.max(8, Math.min(60, Math.round(viewRatio * 100)));
                  const thumbLeftPct = Math.round(leftPct + ( (100 - leftPct - rightPct - thumbWidthPct) * progress ));
                  viewport.style.setProperty('--cards-thumb-left', thumbLeftPct + '%');
                  viewport.style.setProperty('--cards-thumb-width', thumbWidthPct + '%');
                }catch(e){}
              };
              let raf;
              const onScroll = function(){ if(raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(updateThumb); };
              track.addEventListener('scroll', onScroll, { passive: true });
              window.addEventListener('resize', updateThumb);
              setTimeout(updateThumb, 50);
              window.__cointist_cards = window.__cointist_cards || {};
              window.__cointist_cards.disconnect = function(){ try{ track.removeEventListener('scroll', onScroll); window.removeEventListener('resize', updateThumb); }catch(e){} };
            }
          }catch(e){}
        }catch(e){}
      }
      if(document.readyState === 'complete' || document.readyState === 'interactive') initCards(); else window.addEventListener('DOMContentLoaded', initCards);
    })();

  }catch(e){}
}

export function destroy(){
  try{
    if(window.__cointist_scrollspy && window.__cointist_scrollspy.disconnect) try{ window.__cointist_scrollspy.disconnect(); }catch(e){}
    if(window.__cointist_cards && window.__cointist_cards.disconnect) try{ window.__cointist_cards.disconnect(); }catch(e){}
  }catch(e){}
}
