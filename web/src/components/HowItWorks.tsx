import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from '../lib/useInView';

type Tab = 'buyers' | 'sellers';

/** Small line icons. Strokes draw in when the section scrolls into view (see .ico in landing.css). */
const ICONS: Record<string, ReactNode> = {
  link: (
    <>
      <rect x="6" y="8" width="36" height="26" rx="8" />
      <path d="M14 34l-4 8 12-8" />
      <path d="M19 21h10M24 16v10" />
    </>
  ),
  lock: (
    <>
      <rect x="9" y="21" width="30" height="21" rx="5" />
      <path d="M16 21v-6a8 8 0 0116 0v6" />
      <path d="M24 29v6" />
    </>
  ),
  box: (
    <>
      <path d="M6 15l18-9 18 9v18l-18 9-18-9z" />
      <path d="M6 15l18 9 18-9M24 24v18" />
    </>
  ),
  shield: (
    <>
      <path d="M24 5l16 6v11c0 10-7 17-16 21C15 39 8 32 8 22V11z" />
      <path d="M17 24l5 5 9-10" />
    </>
  ),
  tag: (
    <>
      <path d="M5 24V8a3 3 0 013-3h16l19 19-19 19z" />
      <circle cx="15" cy="15" r="3" />
    </>
  ),
  send: (
    <>
      <path d="M43 6L5 21l14 6 6 15z" />
      <path d="M19 27L43 6" />
    </>
  ),
  check: (
    <>
      <circle cx="24" cy="24" r="19" />
      <path d="M15 25l7 7 12-14" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="19" cy="14" rx="12" ry="6" />
      <path d="M7 14v10c0 3 5 6 12 6M7 24v10c0 3 5 6 12 6" />
      <ellipse cx="32" cy="29" rx="11" ry="6" />
      <path d="M21 29v9c0 3 5 6 11 6s11-3 11-6v-9" />
    </>
  ),
};

const CONTENT: Record<Tab, { icon: string; title: string; text: string }[]> = {
  buyers: [
    { icon: 'link', title: 'Get the seller\'s link', text: 'The seller sends a BuyBridge link or product code in your chat. Open it, pick your colour, size or model, and the quantity.' },
    { icon: 'lock', title: 'Sign up, then pay', text: 'New here? A quick sign-up, then your delivery details. Your payment is verified and held under BuyBridge\'s protection terms.' },
    { icon: 'box', title: 'Receive your order', text: 'The seller ships and adds a waybill reference. Follow progress on your order page, then confirm when it arrives.' },
    { icon: 'shield', title: 'A window to speak up', text: 'After delivery, a protection window runs (72 hours in this test version). Report a problem and the payment is held while it is reviewed.' },
  ],
  sellers: [
    { icon: 'tag', title: 'Start selling, list a product', text: 'Switch on selling on your account, add the product, its price and choices like colour and size. You get a link.' },
    { icon: 'send', title: 'Share it in your chat', text: 'Send the link in WhatsApp, Instagram or TikTok DMs. Buyers pay before you ship.' },
    { icon: 'box', title: 'Accept and ship', text: 'When the buyer\'s payment is secured, accept the order, ship it and add the waybill reference.' },
    { icon: 'coins', title: 'Get paid', text: 'Once delivery is confirmed and the protection window passes with no dispute, your Protected Funds become available.' },
  ],
};

export function HowItWorks() {
  const [tab, setTab] = useState<Tab>('buyers');
  const { ref, seen } = useInView<HTMLDivElement>(0.2);
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({ buyers: null, sellers: null });
  const order: Tab[] = ['buyers', 'sellers'];

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = order[(order.indexOf(tab) + 1) % order.length];
    setTab(next);
    tabs.current[next]?.focus();
  }

  return (
    <section className="sec" id="how">
      <div className="sec__head">
        <p className="eyebrow">How it works</p>
        <h2>Four steps, whichever side you're on</h2>
      </div>

      <div className="tabs" role="tablist" aria-label="Choose your side" onKeyDown={onKey}>
        {order.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabs.current[t] = el;
            }}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className="tabs__t"
            onClick={() => setTab(t)}
          >
            {t === 'buyers' ? "I'm a buyer" : "I'm a seller"}
          </button>
        ))}
      </div>

      <div ref={ref} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={`steps${seen ? ' steps--in' : ''}`} key={tab}>
        {CONTENT[tab].map((s, i) => (
          <article className="step" key={s.title} style={{ ['--i' as string]: i }}>
            <svg className="ico" viewBox="0 0 48 48" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[s.icon]}
            </svg>
            <span className="step__n">Step {i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>

      <div className="sec__cta">
        <Link className="btn btn--lg" to={tab === 'buyers' ? '/get-started' : '/start-selling'}>
          {tab === 'buyers' ? 'Create your account' : 'Start selling'}
        </Link>
      </div>
    </section>
  );
}
