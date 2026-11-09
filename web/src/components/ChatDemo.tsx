import { useInView } from '../lib/useInView';

const MESSAGES: Array<{ from: 'seller' | 'buyer' | 'system'; text: string; link?: string }> = [
  { from: 'seller', text: 'Ankara two-piece, size 12. ₦18,500. Pay here and I ship tomorrow:', link: '/p/a1b2c3d4' },
  { from: 'buyer', text: 'How do I know you will actually send it?' },
  { from: 'seller', text: 'Your payment is protected by BuyBridge until the order is delivered.' },
  { from: 'buyer', text: 'Okay, paying now.' },
  { from: 'system', text: 'Payment verified: ₦18,500 Payment Protected. The seller can now ship.' },
];

/** A chat that plays one message at a time when scrolled into view: the exact trust problem BuyBridge removes. */
export function ChatDemo() {
  const { ref, seen } = useInView<HTMLDivElement>(0.3);

  return (
    <section className="sec sec--chat" aria-labelledby="chat-h">
      <div className="sec__head">
        <p className="eyebrow">The problem</p>
        <h2 id="chat-h">Buying in DMs shouldn't take a leap of faith</h2>
        <p>
          Sellers worry the buyer will vanish after the order is packed. Buyers worry the seller will vanish after the
          transfer. BuyBridge adds a structured process in between: verified payment, tracked delivery and a dispute process.
        </p>
      </div>

      <div ref={ref} className={`chat${seen ? ' chat--play' : ''}`} role="img" aria-label="Example chat: a seller shares a BuyBridge link, the buyer asks about trust, the seller explains the money is held, the buyer pays, and BuyBridge confirms the payment is secured.">
        {MESSAGES.map((m, i) => (
          <div key={i} className={`chat__m chat__m--${m.from}`} style={{ ['--d' as string]: `${i * 0.9}s` }}>
            {m.text}
            {m.link && <span className="chat__link">{m.link}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
