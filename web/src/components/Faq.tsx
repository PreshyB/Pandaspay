const ITEMS: Array<[string, string]> = [
  ['Is this real money?', 'Not yet. This is a test version: payments are simulated and no real money moves.'],
  ['Do I need an account?', 'Yes, a free one. Buyers and sellers both sign up with a name and email, which takes under a minute.'],
  ['What if the seller never ships?', 'Your payment stays protected until delivery is confirmed. You can cancel before the seller accepts the order, and you can open a dispute if something goes wrong later.'],
  ['When does the seller get paid?', 'After delivery is confirmed and a 72-hour protection window passes with no dispute. Then the payment is released automatically.'],
  ['What happens in a dispute?', 'The payment freezes so nobody is paid while it is open. It is then resolved in one of three ways: paid to the seller, refunded to the buyer, or split between them.'],
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
