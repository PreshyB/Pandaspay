**PANDAS PAY**

**Fund Custody & Settlement Model**

*Resolving Blueprint Part 22.1 (Legal and Financial Operations) and Part
22.2 (Payment Providers)*

Research note · 8 October 2026 · Status: working assumption, pending
provider and legal confirmation

> *This is informational research to narrow real-world options, not
> legal advice or regulatory clearance. Final sign-off must come from a
> Nigerian fintech/payments lawyer and written confirmation from the
> chosen partner's own compliance team.*

**1. The Core Question**

Before continuing with seller wallet/withdrawal screens or Phase 5
financial architecture, Pandas Pay needs to decide exactly what it is
legally and technically doing with buyer money. The blueprint's language
--- "Payment Protected," "Protected Funds," a settlement/release/ledger
system, and an "Available to Withdraw" seller balance --- describes
something that functions like an escrow or wallet product. In Nigeria,
holding customer funds and controlling when a third party (the seller)
can access them is a regulated activity.

The working principle for this document: Pandas Pay should not assume it
will hold customer funds itself. Pandas Pay can be designed so that a
licensed financial institution is the regulated money custodian, while
Pandas Pay operates the commerce, protection, order, dispute and
orchestration layer on top.

**2. Three Broad Architectures**

  ---------------------- ------------------------------------------------
  **Model**              **Description**

  **A. Pandas Pay holds  Pandas Pay becomes the custodian directly. Very
  funds itself**         high regulatory burden. Not recommended.

  **B. Licensed partner  A regulated bank, MFB or MMO holds the money
  holds funds            under its own license. Pandas Pay instructs
  (recommended)**        release/refund but never takes custody. This is
                         the direction to build toward.

  **C. Normal payment →  Low custody risk, but provides no real "hold
  seller immediately**   until delivery" protection --- doesn't support
                         the product Pandas Pay is meant to be.
  ---------------------- ------------------------------------------------

Recommendation: investigate and build toward Model B. The key
separation: Pandas Pay does not become the bank. Pandas Pay manages the
transaction and protection workflow; the licensed financial partner
manages the actual movement and custody of funds.

**3. Nigerian CBN Licensing Categories --- Why This Is Not Just a
Business Decision**

Nigeria's CBN payment licensing has several distinct tiers, and which
tier a provider's relevant entity holds determines whether it can
legally hold funds at all. This is the single fact that resolves most of
the ambiguity in Part 22.1:

  --------------- ------------- -----------------------------------------
  **License       **Can it hold **What it means for Pandas Pay**
  category**      funds?**      

  PSSP (Payment   **No**        A PSSP license does not authorize holding
  Solution                      customer funds or issuing wallets. A
  Service                       standard payment-gateway merchant account
  Provider)                     under this license alone cannot legally
                                support "hold funds until delivery is
                                confirmed."

  MMO (Mobile     **Yes**       Licensed to let customers save, receive
  Money Operator)               and spend money from a mobile phone, with
                                that money stored in a wallet. OPay and
                                PalmPay both operate as MMOs.

  MFB             **Yes**       Full deposit-taking bank license.
  (Microfinance                 Moniepoint MFB is a CBN-licensed,
  Bank)                         deposit-taking microfinance bank,
                                nationally licensed as of January 2026.
                                This is the cleanest legal footing for
                                holding third-party funds.
  --------------- ------------- -----------------------------------------

> *The real question for any candidate provider is not "do they have a
> payments API" --- it is "which specific licensed entity, under which
> license type, is actually going to hold the money, and does that
> license permit it."*

**4. Real-World Precedent**

A Nigerian startup doing close to what Pandas Pay intends launched in
June 2026 and answers this question directly in practice. EscrowPay is a
WhatsApp-native escrow service for Nigerian buyers and sellers: buyer
payments sit in a designated account with Rubies Microfinance Bank, a
CBN-licensed Nigerian bank, rather than on EscrowPay's own books, and
remain there until the transaction is complete. Funds are released to
the seller, or refunded to the buyer, only after review.

This is Model B, operating today in the same market Pandas Pay targets.
It also shows that the licensed partner does not have to be one of the
large consumer wallet apps --- a designated/collection account
relationship with any CBN-licensed MFB willing to offer that product is
sufficient.

**5. Provider-by-Provider Assessment**

The blueprint's Phase-1 provider list (Moniepoint, OPay, PalmPay)
assumed that offering payment APIs implies the ability to support Pandas
Pay's protection model. That assumption needs to be tested directly,
provider by provider:

  ---------------- ------------------------- -------------------------------------
  **Provider**     **Relevant licensed       **Assessment**
                   entity**                  

  **Moniepoint**   Moniepoint MFB            Strongest fit on paper --- a genuine
                   (deposit-taking,          deposit-taking bank sits behind the
                   nationally licensed) +    brand. Still needs their compliance
                   TeamApt                   team to approve this specific
                   (Switch/Processor)        marketplace-hold use case.

  **OPay**         Has both a                Ambiguous which entity Pandas Pay
                   PSSP/merchant-acquiring   would integrate with. The public
                   side (Cashier API,        "Marketplace Payouts" feature likely
                   "Marketplace Payouts")    runs on the PSSP side (pass-through
                   and an MFB subsidiary     processing), which may not legally
                   (OPay Microfinance Bank)  permit holding funds for days. Needs
                                             direct clarification.

  **PalmPay**      MMO-licensed (can hold    Licensing is fine in principle;
                   funds in wallets)         public API/marketplace documentation
                                             is thin. Needs a direct business
                                             conversation before building anything
                                             against it.

  **Specialist MFB Deposit-taking            Not currently on Pandas Pay's
  (e.g. Rubies MFB                           provider list, but worth adding: this
  or equivalent)**                           is the model a direct Nigerian
                                             competitor (EscrowPay) chose, likely
                                             because smaller MFBs are more willing
                                             to set up a bespoke
                                             designated-account product for a
                                             platform than a mass-market consumer
                                             wallet app is.
  ---------------- ------------------------- -------------------------------------

**6. The Recommended Fund-Flow**

Buyer opens a seller's Pandas Pay link, selects a product, and clicks
Buy Now. Pandas Pay creates an order; at this point Pandas Pay has not
received any money.

Buyer pays. The payment is collected into the designated/collection
account held by the licensed partner (an MFB, or an MMO wallet) --- not
into a Pandas Pay-controlled bank account, and not split or paid out to
the seller immediately.

Pandas Pay records an internal transaction and protection state (payment
confirmed, protection active) that mirrors what happened at the partner,
without itself taking custody of the funds.

As the order progresses --- shipped, delivered, confirmation window ---
Pandas Pay's business rules decide whether the transaction becomes
settlement-eligible. Only then does Pandas Pay send a payout instruction
to the licensed partner, who moves the money to the seller's registered
payout destination.

If a dispute is opened, settlement is prevented from completing while
Pandas Pay manages evidence, communication, investigation and the
decision workflow; the financial partner carries out whatever refund or
settlement instruction results.

> *One transaction, one outcome: a transaction's eventual disposition is
> released-to-seller, refunded-to-buyer, or a defined partial split ---
> never both, and never decided independently by two different parts of
> the system.*

**7. What This Changes in the Product and Architecture**

-   "Protected Funds" is redefined precisely: the payment has been
    received into the designated arrangement with the licensed partner,
    and under the applicable transaction terms the seller's settlement
    is not yet available for payout --- not "Pandas Pay is holding your
    money."

-   Sellers should not see a conventional "Pandas Pay wallet." Replace
    "Pandas Pay Balance / Available Balance / Protected Balance /
    Withdraw" with sales-and-settlement language: current sales, pending
    settlement, eligible for payout, and a payout request that calls the
    licensed partner's mechanism.

-   Pandas Pay still keeps its own transaction ledger, but it is
    explicitly an operational/audit record (payment status, protection
    status, partner transaction ID, seller settlement status) --- not a
    representation of funds Pandas Pay itself owns or holds.

-   Database design should avoid wallets, seller_balance, buyer_balance
    and pandas_pay_escrow as core tables. Favor payments,
    payment_events, protection_cases, disputes, refunds, settlements,
    provider_accounts, provider_transactions, provider_webhook_events,
    financial_transactions (Pandas Pay's own record), audit_logs and
    idempotency_keys.

-   "Escrow" is removed from customer-facing language for now.
    Buyer-facing: "Payment Protection --- your payment is protected
    according to the transaction terms." Seller-facing: "Pending
    Settlement --- this transaction is not yet eligible for settlement."
    Admin-facing: "Payment Protection Operations." The correct
    legal/regulated term (escrow, trust/collection arrangement,
    settlement hold, conditional settlement, or something else) gets
    decided once the legal/provider structure is confirmed --- the UI
    should not dictate the legal model.

**8. Four Decisions, In Order**

-   Decision 1 --- Pandas Pay's role: a commerce,
    transaction-protection, dispute and settlement orchestration
    platform --- not, initially, a custodian of customer funds.

-   Decision 2 --- Financial partner: identify the Nigerian licensed
    institution capable of supporting a designated/collection-account
    structure with Pandas Pay-controlled release.

-   Decision 3 --- Fund-flow contract: map exactly where money sits, who
    legally controls it, what event makes it settlement-eligible, who
    authorizes settlement, and the parallel path for disputes and
    refunds.

-   Decision 4 --- Architecture: only after 1--3 are settled, finalize
    the payments, settlements and refunds tables, the financial ledger
    design, seller-balance terminology, the withdrawal flow, admin
    financial controls, webhooks, reconciliation, UI wording and the
    formal state machines.

**9. Immediate Next Steps**

Rather than further research, the remaining gaps are about what each
party will agree to. Three concrete outbound questions:

-   To Moniepoint MFB and OPay's business teams: "Can we hold buyer
    payments in a designated/collection account under your MFB license,
    with payout triggered by our instruction rather than your standard
    settlement cycle?"

-   To PalmPay's business team: the same question, plus "what
    marketplace/platform integration do you actually support today?"

-   To a specialist MFB (e.g. Rubies MFB or an equivalent): the same
    question, as a direct benchmark --- EscrowPay's existence proves at
    least one MFB already says yes to this today.

In parallel, take whatever specific arrangement comes back from these
conversations to a Nigerian fintech/payments lawyer for review. "The
license permits this in principle" and "this specific contract is
compliant" are different questions, and only the second one clears
Pandas Pay to build against it.

*Prepared for Pandas Pay · Working document, not a final legal or
regulatory determination.*
