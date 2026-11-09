import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChatDemo } from '../components/ChatDemo';
import { Faq } from '../components/Faq';
import { HeroScene } from '../components/HeroScene';
import { HowItWorks } from '../components/HowItWorks';
import { useInView } from '../lib/useInView';

function Safety() {
  const { ref, seen } = useInView<HTMLDivElement>(0.25);
  return (
    <section className="sec" id="safety">
      <div className="sec__head">
        <p className="eyebrow">Safety and disputes</p>
        <h2>Protected when it goes right. Frozen when it doesn't.</h2>
      </div>

      <div ref={ref} className={`tracks${seen ? ' tracks--in' : ''}`}>
        <article className="track track--ok">
          <h3>When the order arrives</h3>
          <ol className="rail" aria-label="Payment protection: held, then releasable, then released">
            <li style={{ ['--i' as string]: 0 }}>
              <strong>Held</strong>
              <span>Paid to BuyBridge</span>
            </li>
            <li style={{ ['--i' as string]: 1 }}>
              <strong>72-hour window</strong>
              <span>Starts at delivery</span>
            </li>
            <li style={{ ['--i' as string]: 2 }}>
              <strong>Released</strong>
              <span>Seller is paid</span>
            </li>
          </ol>
          <p>No dispute, no wait for anyone to act. The payout happens on its own.</p>
        </article>

        <article className="track track--bad">
          <h3>When something is wrong</h3>
          <ol className="rail" aria-label="Dispute: payment frozen, then resolved">
            <li style={{ ['--i' as string]: 0 }}>
              <strong>Report it</strong>
              <span>From your order page</span>
            </li>
            <li style={{ ['--i' as string]: 1 }}>
              <strong>Frozen</strong>
              <span>Nobody is paid</span>
            </li>
            <li style={{ ['--i' as string]: 2 }}>
              <strong>Resolved</strong>
              <span>Seller, buyer or split</span>
            </li>
          </ol>
          <p>Open a dispute any time while the payment is protected. The money stays put until it's settled.</p>
        </article>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Payment protection for buying and selling in chat</p>
          <h1>Pay safe. Sellers get paid when it arrives.</h1>
          <p className="hero__lede">
            Found something on WhatsApp, Instagram or TikTok? BuyBridge holds the buyer's payment until delivery is
            confirmed, so neither side has to trust a stranger.
          </p>

          <div className="hero__ctas">
            <Link className="btn btn--lg" to="/get-started?role=buyer">
              I'm buying
            </Link>
            <Link className="btn btn--lg btn--outline" to="/get-started?role=seller">
              I'm selling
            </Link>
          </div>

          <form
            className="find"
            id="find"
            onSubmit={(e) => {
              e.preventDefault();
              if (slug.trim()) navigate(`/p/${slug.trim()}`);
            }}
          >
            <label htmlFor="slug">Already have a product code from a seller?</label>
            <div className="find__row">
              <input
                id="slug"
                className="input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. a1b2c3d4"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button className="btn" type="submit" disabled={!slug.trim()}>
                Find product
              </button>
            </div>
          </form>
        </div>

        <HeroScene />
      </section>

      <ChatDemo />
      <HowItWorks />
      <Safety />
      <Faq />

      <section className="closer">
        <h2>Ready to try it?</h2>
        <p>Make a free account and run a protected order from start to finish.</p>
        <div className="hero__ctas">
          <Link className="btn btn--lg" to="/get-started?role=buyer">
            Start as a buyer
          </Link>
          <Link className="btn btn--lg btn--secondary" to="/get-started?role=seller">
            Start selling
          </Link>
        </div>
      </section>
    </div>
  );
}
