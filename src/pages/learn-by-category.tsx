import React, { useEffect } from 'react';
import Head from 'next/head';
import SiteFooter from '@/components/SiteFooter';
import SEO from '@/components/SEO'
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
    return () => document.removeEventListener('click', onClick);
  }, []);
  return (
    <>
  <SEO title={`Learn by category  Cointist`} description={`Explore Cointist learning content by topic`} image={""} url={""} canonical={"/learn-by-category"} primaryKeyword="learn crypto" keywords={["learn","crypto guides","crypto education"]} author={"Cointist Editorial"} datePublished={""} dateModified={""} />

      <main className={`${styles.page} wrap`}>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-left">
              <h1 className={styles.title}>Learn by category  Learn crypto</h1>
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

            {/* 7 additional copies of the same three cards to populate the grid */}
            {/** copy 1 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
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

            {/** copy 2 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
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

            {/** copy 3 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
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

            {/** copy 4 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
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

            {/** copy 5 **/}
            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
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

            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
              <h2 id="trading" className={styles.sectionTitle}>Trading</h2>
            </div>

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

            <div style={{gridColumn: '1 / -1', padding: '18px 20px 6px'}}>
              <h2 id="scaling" className={styles.sectionTitle}>Scaling</h2>
            </div>
*** End Patch

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

        <div className="grid">
          <div>
            <div className={styles.columns}>
              <aside>
                <div className={styles.featuredCard}>
                  <div className={styles.featuredMeta}>Featured</div>
                  <h2 className={styles.featuredTitle}>Beginner's guide to Bitcoin</h2>
                  <p className={styles.featuredDesc}>A concise walkthrough of Bitcoin fundamentals, how it works and how to hold it safely.</p>
                  <a className={styles.primaryLink} href="#">Read the guide</a>
                </div>

                <div className={styles.subscribeBox}>
                  <h3>Get Cointist updates</h3>
                  <p>Short, practical lessons and timely market explainers in your inbox.</p>
                  <div className={styles.subscribeRow}>
                    <input className={styles.emailInput} aria-label="Email" placeholder="you@domain.com" />
                    <button className={styles.cta}>Subscribe</button>
                  </div>
                </div>
              </aside>

              <div className={styles.rightCol}>
                <h3 className={styles.sectionTitle}>Latest guides</h3>
                <ul className={styles.guideList}>
                  <li className={styles.guideItem}>
                    <div className={styles.guideMeta}>Nov 12 • 8 min read</div>
                    <a className={styles.guideTitle} href="#">How smart contracts work — a non-technical guide</a>
                  </li>
                  <li className={styles.guideItem}>
                    <div className={styles.guideMeta}>Oct 28 • 6 min read</div>
                    <a className={styles.guideTitle} href="#">A practical primer on staking</a>
                  </li>
                  <li className={styles.guideItem}>
                    <div className={styles.guideMeta}>Sep 03 • 10 min read</div>
                    <a className={styles.guideTitle} href="#">Onchain analysis basics for beginners</a>
                  </li>
                  <li className={styles.guideItem}>
                    <div className={styles.guideMeta}>Aug 19 • 5 min read</div>
                    <a className={styles.guideTitle} href="#">Keeping your keys safe: wallet best practices</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <aside className="toc" aria-label="On this page">
            <h4>Sections</h4>
            <ol>
              <li><a href="#bitcoin">Bitcoin</a></li>
              <li><a href="#ethereum">Ethereum</a></li>
              <li><a href="#defi">DeFi</a></li>
              <li><a href="#wallets">Wallets</a></li>
              <li><a href="#regulation">Regulation</a></li>
              <li><a href="#trading">Trading</a></li>
              <li><a href="#scaling">Scaling</a></li>
            </ol>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
