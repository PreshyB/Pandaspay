const ITEMS: Array<[string, string]> = [
  ['Is this real money?', 'Not yet. This is a test version: payments are simulated and no real money moves.'],
  ['Do I need an account?', 'Yes, a free one, with a name and email. One account covers buying, and you can switch on selling from the same account later.'],
  ['What if the seller never ships?', 'Your payment stays under BuyBridge protection until delivery is confirmed. You can cancel before the seller accepts the order, and open a dispute if something goes wrong later. Protection follows BuyBridge\'s terms and doesn\'t guarantee every transaction.'],
  ['When does the seller get paid?', 'After delivery is confirmed and a protection window passes with no dispute. In this test version the window is 72 hours; the final rules are still being decided.'],
  ['What happens in a dispute?', 'The payment is held while the dispute is open. It is then resolved in one of three ways: released to the seller, refunded to the buyer, or split between them.'],
  ['What does it cost?', 'This test version does not charge any fees. Pricing will be shared before real payments go live.'],
  ['Can I sign in from another phone or laptop?', 'Not yet. In this version your account is saved in the browser you signed up in. Full login is coming.'],
];

export function Faq() {
  return (
    <section className="sec" id="faq">
      <div className="sec__head">
        <p className="eyebrow">Questions</p>
        <h2>Things people ask first</h2>
      </div>
      <div className="faq">
        {ITEMS.map(([q, a]) => (
          <details key={q} className="faq__i">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
