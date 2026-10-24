**PANDAS PAY**

**Order Status & Payment Protection**

**State-Machine Specification**

*Formalizes the dual-status model shown in the Wireflow\'s \"system\"
reference screen, updated for the Model B (licensed-partner-custody)
fund-flow*

Specification v1.0 · 8 October 2026 · Status: ready for backend
implementation, pending final provider/legal confirmation of the Model B
fund-flow

> *Enum names and exact trigger wording here are a proposal for
> engineering convention, not yet locked. Everything that depends on the
> Model B fund-flow (the definitions of RELEASED, REFUND_APPROVED and
> PARTIALLY_RESOLVED) should be re-checked once a specific licensed
> partner and contract are confirmed --- see Pandas Pay --- Fund Custody
> & Settlement Model.*

**1. Why Two Independent State Machines**

Every order in Pandas Pay is tracked on two state machines at once,
never collapsed into a single status line:

-   Order status --- the fulfillment/delivery track. Owned by the
    seller\'s and courier\'s actions.

-   Payment protection status --- the financial track. Owned by the
    buyer\'s payment, the licensed partner\'s custody of funds, and any
    dispute.

The two are deliberately decoupled so that combinations which a single
linear flow cannot express become first-class, representable states:

-   A dispute can hold the payment track at DISPUTED while the order
    track continues to show DELIVERED --- the buyer still sees accurate
    delivery information while money is frozen.

-   A partial refund can leave the order DELIVERED permanently while the
    payment track resolves to PARTIALLY_RESOLVED --- not representable
    in a single linear flow.

-   An automated release and an admin-initiated refund are prevented
    from firing on the same transaction by requiring both to acquire the
    same disposition lock (§5) --- whichever wins is reflected as a
    single terminal payment state, never both.

Every screen that shows order information reads from both machines
independently and renders two badges, never merges them into one piece
of copy.

**2. Order Status**

**2.1 States**

  --------------- ----------------- -------------------------------------------
  **State**       **Enum value**    **Definition**

  **Created**     CREATED           Order placed and payment is confirmed or in
                                    progress. Seller has not yet acted on it.
                                    Initial state for every order.

  **Cancelled**   CANCELLED         Order did not proceed to fulfillment ---
                                    seller declined, or buyer cancelled before
                                    the seller accepted. Not in the current
                                    Wireflow pill row; added here because every
                                    order needs a pre-fulfillment exit.
                                    Terminal for the order track; always pairs
                                    with a refund on the payment track.

  **Preparing**   PREPARING         Seller has accepted the order and is
                                    assembling/packing it. Buyer-info is now
                                    visible to the seller (per the accept-order
                                    screen).

  **Shipped**     SHIPPED           Seller has marked the order dispatched and
                                    logged a waybill/reference. This is a
                                    seller claim, not courier-verified proof
                                    --- treated that way throughout the UI.

  **In transit**  IN_TRANSIT        Optional intermediate state once a
                                    carrier/dispatch-rider tracking update is
                                    available. Orders without live tracking may
                                    move straight from Shipped to Delivered.

  **Delivered**   DELIVERED         Delivery is confirmed --- by buyer
                                    confirmation, courier proof-of-delivery, or
                                    an auto-confirm timeout after no buyer
                                    response. This is the event that starts the
                                    protection-release countdown on the payment
                                    track.

  **Delivery      DELIVERY_FAILED   A delivery attempt did not succeed (buyer
  failed**                          unreachable, address issue, refused
                                    parcel). Not terminal --- resolves into a
                                    re-attempt (back to In transit) or a
                                    return.

  **Returned**    RETURNED          Parcel is confirmed back with the seller,
                                    whether from a failed-delivery path or a
                                    post-delivery dispute resolution. Terminal
                                    for the order track.
  --------------- ----------------- -------------------------------------------

**2.2 Valid transitions**

  ------------------ -------------------- ----------------------------------
  **From → To**      **Trigger**          **Notes**

  CREATED →          Seller accepts order Requires payment track to already
  PREPARING                               be at PROTECTED or beyond
                                          AWAITING_PAYMENT --- a seller
                                          cannot accept an unpaid order.

  CREATED →          Seller declines, or  Must atomically request a refund
  CANCELLED          buyer cancels        on the payment track --- see §5.
                     pre-acceptance       No order may sit at CANCELLED
                                          while payment remains PROTECTED.

  PREPARING →        Seller marks         Triggers buyer notification and
  SHIPPED            shipped + logs       starts the expected-delivery-date
                     waybill              estimate shown on the tracking
                                          screen.

  SHIPPED →          Carrier/dispatch     Optional --- skip directly to
  IN_TRANSIT         tracking webhook or  DELIVERED where no live tracking
                     manual seller update integration exists.

  SHIPPED /          Buyer confirms       The single most important trigger
  IN_TRANSIT →       receipt, courier     in the whole system --- it starts
  DELIVERED          proof-of-delivery,   the protection countdown
                     or auto-confirm      (PROTECTED → RELEASABLE) on the
                     timeout              payment track. Must be logged with
                                          which of the three sources fired
                                          it.

  SHIPPED /          Delivery attempt     Does not touch the payment track
  IN_TRANSIT →       unsuccessful         by itself. Pure fulfillment-side
  DELIVERY_FAILED                         fact.

  DELIVERY_FAILED →  Re-attempt scheduled Loop is allowed to repeat; cap
  IN_TRANSIT                              re-attempts per the delivery-rules
                                          business policy (blueprint Part
                                          22.4).

  DELIVERY_FAILED →  Re-attempts          Should trigger a refund decision
  RETURNED           exhausted, parcel    on the payment track --- the buyer
                     confirmed back with  never received the goods.
                     seller               

  DELIVERED →        Post-delivery        Rare path, only reachable via a
  RETURNED           dispute resolved as  DISPUTED payment-track resolution,
                     \"buyer returns      never directly by buyer or seller
                     item\"               action.
  ------------------ -------------------- ----------------------------------

**3. Payment Protection Status**

**3.1 States**

  ---------------- -------------------- ------------------------------------------
  **State**        **Enum value**       **Definition**

  **Payment        AWAITING_PAYMENT     Order created; buyer has not yet completed
  pending**                             payment, or the provider has not yet
                                        confirmed it (the \"still confirming\"
                                        screen). Initial state.

  **Payment        PAYMENT_DECLINED     Provider declined the attempt. Not
  declined**                            terminal --- the order and inventory
                                        reservation survive, and a new attempt
                                        returns the transaction to
                                        AWAITING_PAYMENT under a new idempotency
                                        key.

  **Protected**    PROTECTED            Payment is confirmed and sits in the
                                        licensed partner\'s designated/collection
                                        account (Model B). This is what \"Payment
                                        protection active\" means on the buyer
                                        success screen --- Pandas Pay has recorded
                                        the protection, not taken custody of the
                                        money itself.

  **Disputed**     DISPUTED             A buyer or seller dispute is open. Freezes
                                        the payment track --- no release, refund
                                        or settlement instruction may be sent
                                        while in this state. Independent of
                                        whatever the order track currently shows.

  **Releasable**   RELEASABLE           The protection window has elapsed (or the
                                        buyer confirmed receipt) with no open
                                        dispute. Eligible for payout, but the
                                        instruction has not been sent yet --- this
                                        is a queued/pending-settlement state, not
                                        yet money-in-motion.

  **Released**     RELEASED             Terminal. Redefined for Model B: Pandas
                                        Pay has sent a payout instruction to the
                                        licensed partner for this transaction. It
                                        records that the instruction was sent and
                                        (once the partner confirms via webhook)
                                        that it was executed --- never that Pandas
                                        Pay itself moved the money.

  **Refund         REFUND_APPROVED      A full refund has been decided (dispute
  approved**                            resolution or pre-acceptance cancellation)
                                        and the refund instruction is queued to
                                        the licensed partner but not yet confirmed
                                        executed.

  **Refunded**     REFUNDED             Terminal. The licensed partner has
                                        confirmed the refund instruction executed
                                        and returned funds to the buyer\'s
                                        original payment method or registered
                                        account.

  **Partially      PARTIALLY_RESOLVED   Terminal. A dispute resolved as a split
  resolved**                            --- part of the protected amount released
                                        to the seller, part refunded to the buyer.
                                        Recorded as two linked settlement
                                        instructions under one disposition, never
                                        as two independent transactions.
  ---------------- -------------------- ------------------------------------------

**3.2 Valid transitions**

  -------------------- ------------------ --------------------------------
  **From → To**        **Trigger**        **Notes**

  AWAITING_PAYMENT →   Provider/partner   Must be idempotent on the
  PROTECTED            confirms payment   provider\'s transaction
                       (webhook)          reference --- a redelivered
                                          webhook must not double-protect.

  AWAITING_PAYMENT →   Provider declines  Inventory reservation and cart
  PAYMENT_DECLINED     the attempt        survive; see Order §2b CREATED →
                                          CANCELLED for the separate
                                          pre-acceptance cancellation
                                          path.

  PAYMENT_DECLINED →   Buyer retries with New idempotency key per attempt;
  AWAITING_PAYMENT     a new attempt      the order\'s reservation does
                                          not need to be re-created.

  PROTECTED → DISPUTED Buyer or seller    Allowed from PROTECTED at any
                       opens a dispute    point, and from RELEASABLE up
                       within the window  until the release instruction is
                                          actually sent (see lock, §5).

  RELEASABLE →         Late-opened        Race-sensitive --- must go
  DISPUTED             dispute before the through the same disposition
                       release            lock described in §5 so a
                       instruction fires  dispute cannot open after
                                          release has already been
                                          instructed.

  PROTECTED →          Order reaches      Driven by the order-status
  RELEASABLE           DELIVERED and the  DELIVERED event plus a scheduled
                       protection window  timer --- see §4 worked example.
                       elapses with no    
                       open dispute       

  RELEASABLE →         Settlement job     Acquires the disposition lock
  RELEASED             sends the payout   --- see §5.
                       instruction;       
                       partner confirms   
                       execution          

  DISPUTED →           Dispute resolved   Re-enters the normal release
  RELEASABLE           in seller\'s favor path from RELEASABLE.

  DISPUTED →           Dispute resolved   Acquires the disposition lock
  REFUND_APPROVED      in buyer\'s favor  --- see §5.
                       (full refund)      

  DISPUTED →           Dispute resolved   Acquires the disposition lock
  PARTIALLY_RESOLVED   as a split         --- see §5. Records two linked
                                          instructions under one
                                          disposition.

  CANCELLED order →    Seller decline or  Only reachable while payment is
  REFUND_APPROVED      pre-acceptance     still PROTECTED (not yet
                       buyer cancellation RELEASABLE) --- a cancellation
                                          after release is a dispute, not
                                          a cancellation.

  REFUND_APPROVED →    Licensed partner   Terminal.
  REFUNDED             confirms refund    
                       executed (webhook) 
  -------------------- ------------------ --------------------------------

**4. Worked Combined-State Examples**

A non-exhaustive set of (order status, payment status) pairings that
occur in normal operation, matched to what the Wireflow\'s screens show
for each:

  -------------- ---------------- -------------------- ----------------------------
  **Scenario**   **Order status** **Payment status**   **What the buyer/seller
                                                       screens show**

  Order just     CREATED          AWAITING_PAYMENT     \"Still confirming\" if the
  placed                                               provider hasn\'t responded
                                                       yet; otherwise moves
                                                       straight through.

  Normal happy   SHIPPED          PROTECTED            Tracking card shows
  path,                                                \"Shipped\" + expected
  mid-delivery                                         delivery date; order detail
                                                       shows \"Payment protected\"
                                                       badge.

  Dispute opened DELIVERED        DISPUTED             This is the pairing the
  after delivery                                       Wireflow\'s \"why two
                                                       tracks\" note calls out by
                                                       name --- delivery info stays
                                                       accurate while the payment
                                                       track freezes.

  Window         DELIVERED        RELEASABLE           Seller funds screen shows
  elapsed, no                                          the amount moving from
  dispute                                              \"Pending settlement\" to
                                                       \"Eligible for payout.\"

  Delivery       RETURNED         REFUND_APPROVED →    Buyer sees a refund screen;
  failed, parcel                  REFUNDED             no dispute flow needed since
  returned                                             the failure is
                                                       fulfillment-side fact, not a
                                                       claim.

  Dispute        DELIVERED        PARTIALLY_RESOLVED   Order track never changes
  resolved as                                          --- the item was delivered
  split                                                --- only the payment track
                                                       records the split outcome.

  Seller         CANCELLED        REFUND_APPROVED →    Buyer sees \"Seller was
  declines order                  REFUNDED             unable to fulfil this order
                                                       --- refund initiated,\" not
                                                       a dispute screen.
  -------------- ---------------- -------------------- ----------------------------

**5. The Disposition Lock --- Refund/Release Mutual Exclusion**

A protection transaction has exactly one terminal financial disposition:
RELEASED, REFUNDED, or PARTIALLY_RESOLVED. It must never receive two.
The risk is concrete --- an automated settlement job scanning for
RELEASABLE transactions and an admin resolving a dispute can both decide
to act on the same transaction at nearly the same moment.

Mechanism: the transition into any terminal disposition is a single
conditional write --- a compare-and-swap against the transaction\'s
current payment status (e.g. \"update \... set status = \'RELEASED\'
where id = ? and status = \'RELEASABLE\'\"), performed inside the same
database transaction as the outbound instruction record. Whichever
process\'s write affects zero rows has lost the race, must not send a
payout or refund instruction to the licensed partner, and logs a
disposition conflict for audit rather than silently retrying.

-   The lock is acquired on the attempt to leave RELEASABLE or DISPUTED
    for a terminal state --- not earlier --- so opening a late dispute
    (RELEASABLE → DISPUTED) is still possible right up until the moment
    a release instruction has actually been recorded.

-   Every outbound instruction to the licensed partner (payout or
    refund) carries its own idempotency key derived from the transaction
    id and disposition, so a retried or duplicated instruction-send
    never results in two real-world transfers even if the lock logic has
    a bug.

-   A PARTIALLY_RESOLVED disposition still acquires the lock exactly
    once --- the two linked instructions (partial payout + partial
    refund) are written and sent together under that single disposition,
    not as two separate lock acquisitions.

> *Rule of record: if the disposition column already holds a terminal
> value, no code path may overwrite it. Reversing a settled disposition
> is a new, separate financial event (e.g. a clawback), not a state
> transition on the original transaction.*

**6. Who Can Trigger Each Transition**

-   Buyer: confirms delivery receipt (order → DELIVERED); opens a
    dispute (payment → DISPUTED); retries a declined payment.

-   Seller: accepts or declines an order (order → PREPARING /
    CANCELLED); marks shipped (order → SHIPPED); responds to a dispute.

-   Courier / dispatch integration: posts tracking updates (order →
    IN_TRANSIT, DELIVERY_FAILED) where a live integration exists.

-   System scheduler: auto-confirms delivery after a timeout (order →
    DELIVERED); runs the settlement job that moves eligible transactions
    from RELEASABLE to RELEASED.

-   Licensed partner (via webhook): confirms a payment (payment →
    PROTECTED), a payout, or a refund (payment → RELEASED / REFUNDED).
    Pandas Pay never marks a transaction RELEASED or REFUNDED on its own
    say-so --- only on the partner\'s confirmation.

-   Admin (Payment Protection Operations): resolves a dispute to
    RELEASABLE, REFUND_APPROVED or PARTIALLY_RESOLVED; can place a
    manual hold on a transaction regardless of its current state.

**7. Idempotency & Webhook Handling**

Every transition that originates from an external signal --- a
payment-provider webhook, a licensed-partner payout/refund confirmation,
a courier tracking update --- must be idempotent against that signal\'s
own reference id, since the same webhook can be redelivered.

-   provider_webhook_events (or equivalent) stores every inbound webhook
    with its provider reference id as a unique key; a duplicate delivery
    is recognized and discarded before it can re-trigger a transition.

-   payment_events records every payment-status transition with the
    event that caused it (webhook id, scheduler run id, admin user id,
    or buyer/seller action) for audit and support investigation.

-   Outbound instructions to the licensed partner carry a Pandas
    Pay-generated idempotency key, so a retried request on a flaky
    connection cannot result in two transfers.

-   Every write that changes order status or payment status is wrapped
    with the actor and reason it recorded --- this is what lets the
    admin dispute/audit screens explain \"why is this transaction in
    this state\" without guessing.

**8. What This Replaces in the Blueprint / Wireflow**

-   Blueprint Part 10 (\"transaction state machine\") is superseded by
    §2 and §3 above as the authoritative state list and transition
    table.

-   The Wireflow\'s \"system\" reference screen\'s two pill-rows should
    be updated to include CANCELLED (order track) and AWAITING_PAYMENT /
    PAYMENT_DECLINED / REFUND_APPROVED / PARTIALLY_RESOLVED (payment
    track) so the reference screen matches this specification exactly.

-   RELEASED is redefined per the Fund Custody & Settlement Model: a
    payout instruction sent to (and confirmed by) the licensed partner
    --- never Pandas Pay moving money on its own books.

**9. Suggested Next Steps**

-   Ratify the enum names in §2.1 / §3.1 as the literal database and API
    values (or adjust and re-issue this document) before any backend
    module is built against them.

-   Design the payments / payment_events / protection_cases / disputes /
    refunds / settlements / provider_webhook_events / idempotency_keys
    tables directly off §2--§5 --- the state tables above are written to
    map onto rows, not just UI copy.

-   Build Admin v0.3 (dispute case management, webhook investigation,
    the disposition-lock audit view) against this specification, since
    every admin action in that surface is a transition defined here.

-   Write the settlement-job and webhook-handler pseudocode directly
    from §5 and §7 before implementation, so the compare-and-swap and
    idempotency-key logic is reviewed once, in one place, rather than
    reconstructed ad hoc per handler.

*Prepared for Pandas Pay · Engineering specification, to be ratified by
the backend team before implementation.*
