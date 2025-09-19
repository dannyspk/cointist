import React, { useEffect } from 'react';
import Head from 'next/head';
import SiteFooter from '@/components/SiteFooter';
import styles from '@/styles/learnByCategory.module.css';

export default function LearnByCategory() {
  useEffect(() => {
    // delegated click handler: smooth-scroll fallback for anchor clicks
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;
      const anchor = target.closest && (target.closest('a') as HTMLAnchorElement | null);
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('#') || href === '#') return;
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // update history so back/forward still work
        history.replaceState(null, '', `#${id}`);
      }
    }

    document.addEventListener('click', onClick);

    // pager click handling: look for .sectionPager button clicks
    function onPagerClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;
      const btn = target.closest && (target.closest('.sectionPager button') as HTMLButtonElement | null);
      if (!btn) return;
      const container = btn.closest && (btn.closest('[data-section]') as HTMLElement | null);
      const page = btn.getAttribute('data-page');
      if (!container || !page) return;
      // visually mark the active button
      container.querySelectorAll('.sectionPager button').forEach(b => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      // NOTE: data fetching not implemented here; placeholder for future fetch
      console.log('Requested page', page, 'for section', container.getAttribute('data-section'));
    }

    document.addEventListener('click', onPagerClick);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('click', onPagerClick); };
  }, []);
  return (
    <>
      <Head>
        <title>Learn by category — Cointist</title>
        <meta name="description" content="Explore Cointist learning content by topic" />
      </Head>

      <main className={`${styles.page} wrap`}>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-left">
              <h1 className={styles.title}>Learn by category</h1>
              <p className={styles.subtitle}>Guides, explainers and quick reads — organized by topic so you can learn the parts that matter.</p>

              <div className={styles.topicNav} role="navigation" aria-label="Browse topics">
                <a className={styles.topicPill} href="#bitcoin">Bitcoin</a>
                <a className={styles.topicPill} href="#ethereum">Ethereum</a>
                <a className={styles.topicPill} href="#defi">DeFi</a>
                <a className={styles.topicPill} href="#wallets">Wallets</a>
                <a className={styles.topicPill} href="#regulation">Regulation</a>
                <a className={styles.topicPill} href="#trading">Trading</a>
                <a className={styles.topicPill} href="#scaling">Scaling</a>
              </div>
            </div>
          </div>
        </section>

        {/* Featured / trending cards: three-column grid */}
        <section className={styles.featuredSection} aria-labelledby="featured-heading">
          <div className="hero-inner">
            <h2 id="featured-heading" className={styles.sectionTitle}>Trending articles</h2>
            <p className={styles.sectionDesc}>All the hottest topics in one place, so you never miss a beat.</p>
          </div>

          <div className={styles.cardsGrid}>
            {/* original set */}
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="bitcoin" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/* 7 additional copies of the same three cards to populate the grid */}
            {/** copy 1 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
                <h2 id="bitcoin" className={styles.sectionTitle}>Bitcoin</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="ethereum" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/** copy 2 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="ethereum" className={styles.sectionTitle}>Ethereum</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="defi" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/** copy 3 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="defi" className={styles.sectionTitle}>DeFi</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="wallets" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/** copy 4 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="wallets" className={styles.sectionTitle}>Wallets</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="regulation" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/** copy 5 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="regulation" className={styles.sectionTitle}>Regulation</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="trading" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            {/** copy 6 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="trading" className={styles.sectionTitle}>Trading</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/card-tokenization.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">12 trading tools for strategic crypto, stock and ETF investing</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>12 min read • Beginner</div>
              </div>
            </article>
            
            {/* duplicate placeholders to make Trading have 3 cards */}
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
            <div data-section="scaling" style={{gridColumn:'1 / -1'}}>
              <div className={styles.sectionPager}>
                <button data-page="1" aria-current="true">1</button>
                <button data-page="2">2</button>
                <button data-page="3">3</button>
              </div>
            </div>

            <div style={{gridColumn: '1 / -1', padding: '18px 3px 6px'}}>
              <h2 id="scaling" className={styles.sectionTitle}>Scaling</h2>
            </div>
            
            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/Markets.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">Tokenized equities: Transforming liquidity and accessibility</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>11 min read</div>
              </div>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.cardImage} aria-hidden>
                <img src="/assets/guides/DeFi.webp" alt="Illustration" />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}><a href="#">11 futures trading strategies to sharpen your market edge</a></h3>
                <div className={styles.cardExcerpt} aria-hidden></div>
                <div className={styles.cardMeta}>19 min read</div>
              </div>
            </article>
          </div>
        </section>

        
      </main>

      <SiteFooter />
    </>
  );
}
