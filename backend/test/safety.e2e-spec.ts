import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PaymentProtectionStatus as S } from '../src/common/enums/payment-protection-status.enum';
import { Payment } from '../src/payments/entities/payment.entity';
import { Settlement } from '../src/payments/entities/settlement.entity';
import { PaymentsService } from '../src/payments/payments.service';
import { Dispute } from '../src/disputes/entities/dispute.entity';
import { User, UserRole } from '../src/users/user.entity';

/**
 * Safety checks for the money paths: no payment may be both released and refunded,
 * two decisions at once cannot both win, permissions hold when enforced, and the books reconcile.
 * Needs the same Postgres as order-flow.e2e-spec.ts.
 */
describe('Money safety, permissions and reconciliation (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let payments: PaymentsService;
  const api = () => request(app.getHttpServer());
  const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    process.env.DB_SYNCHRONIZE = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
    payments = app.get(PaymentsService);
  });

  afterAll(async () => {
    delete process.env.AUTH_ENFORCED;
    delete process.env.ADMIN_EMAILS;
    await app.close();
  });

  async function newUser(label: string) {
    const r = await api().post('/users').send({ email: `${label}-${stamp()}@example.com`, fullName: label }).expect(201);
    return r.body as { id: string; email: string; roles: UserRole[] };
  }

  /** A paid (PROTECTED) order of 5,000 NGN between a fresh buyer and seller. */
  async function protectedPayment() {
    const buyer = await newUser('buyer');
    const seller = await newUser('seller');
    await ds.getRepository(User).update(seller.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
    const product = await api().post('/products').send({ sellerId: seller.id, title: 'Item', priceMinor: '500000' }).expect(201);
    const created = await api()
      .post('/orders')
      .send({ buyerId: buyer.id, sellerId: seller.id, items: [{ productId: product.body.id, quantity: 1 }] })
      .expect(201);
    const paymentId: string = created.body.payment.id;
    await api()
      .post('/webhooks/palmpay')
      .send({ eventId: `evt-${paymentId}`, eventType: 'payment.confirmed', providerTransactionRef: created.body.payment.providerTransactionRef })
      .expect(201);
    return { buyer, seller, paymentId, orderId: created.body.order.id as string };
  }

  const status = async (paymentId: string) => (await ds.getRepository(Payment).findOneByOrFail({ id: paymentId })).protectionStatus;
  const settlements = (paymentId: string) => ds.getRepository(Settlement).find({ where: { paymentId } });

  it('a cancellation refund and the release step racing never end with both a refund and a release', async () => {
    for (let i = 0; i < 5; i++) {
      const { paymentId } = await protectedPayment();
      await Promise.allSettled([
        payments.approveRefundForCancellation(paymentId, 'BUYER', 'test'),
        payments.markReleasable(paymentId),
      ]);
      const final = await status(paymentId);
      const sent = await settlements(paymentId);
      if (final === S.REFUND_APPROVED) expect(sent.filter((s) => s.kind === 'REFUND')).toHaveLength(1);
      else {
        expect(final).toBe(S.RELEASABLE);
        expect(sent).toHaveLength(0); // no refund went out for a payment that is now releasable
      }
    }
  });

  it('two admins deciding the same dispute at once: exactly one decision is applied', async () => {
    const { buyer, paymentId } = await protectedPayment();
    const opened = await api().post('/disputes').send({ paymentId, openedById: buyer.id, reason: 'Not as described' }).expect(201);
    const id: string = opened.body.id;

    const [a, b] = await Promise.all([
      api().patch(`/disputes/${id}/resolve-buyer`).send({ resolvedById: 'admin-a', notes: 'refund them' }),
      api().patch(`/disputes/${id}/resolve-seller`).send({ resolvedById: 'admin-b', notes: 'pay the seller' }),
    ]);
    expect([a.status, b.status].filter((s) => s >= 200 && s < 300)).toHaveLength(1);

    const final = await status(paymentId);
    const sent = await settlements(paymentId);
    const dispute = await ds.getRepository(Dispute).findOneByOrFail({ id });
    if (final === S.REFUND_APPROVED) {
      expect(sent.filter((s) => s.kind === 'REFUND')).toHaveLength(1);
      expect(dispute.status).toBe('RESOLVED_BUYER');
    } else {
      expect(final).toBe(S.RELEASABLE);
      expect(sent).toHaveLength(0);
      expect(dispute.status).toBe('RESOLVED_SELLER');
    }
  });

  it('a split must be two positive amounts that add up to the payment', async () => {
    const { buyer, paymentId } = await protectedPayment();
    const opened = await api().post('/disputes').send({ paymentId, openedById: buyer.id, reason: 'Damaged' }).expect(201);
    const body = (release: string, refund: string) => ({ resolvedById: 'admin', releaseMinor: release, refundMinor: refund, sellerPayoutDestination: {} });

    await api().patch(`/disputes/${opened.body.id}/resolve-split`).send(body('-100', '500100')).expect(400);
    await api().patch(`/disputes/${opened.body.id}/resolve-split`).send(body('0', '500000')).expect(400);
    await api().patch(`/disputes/${opened.body.id}/resolve-split`).send(body('100000', '100000')).expect(400); // does not add up
    expect(await status(paymentId)).toBe(S.DISPUTED); // nothing moved
    await api().patch(`/disputes/${opened.body.id}/resolve-split`).send(body('200000', '300000')).expect(200);
    expect(await status(paymentId)).toBe(S.PARTIALLY_RESOLVED);
    expect(await settlements(paymentId)).toHaveLength(2);
  });

  it('the books reconcile after a release, a refund and a split', async () => {
    const released = await protectedPayment();
    await payments.markReleasable(released.paymentId);
    await payments.release(released.paymentId, { bankAccount: 'x' });

    const refunded = await protectedPayment();
    await payments.approveRefundForCancellation(refunded.paymentId, 'BUYER', 'test');

    const res = await api().get('/ledger/reconciliation').expect(200);
    const mine = (res.body.issues as Array<{ paymentId: string; problem: string }>).filter((i) =>
      [released.paymentId, refunded.paymentId].includes(i.paymentId),
    );
    expect(mine).toEqual([]);
  });

  it('payouts: eligible money is requested, approved by an admin, paid once, and not requestable again', async () => {
    const { seller, paymentId } = await protectedPayment();
    await payments.markReleasable(paymentId);

    const before = await api().get(`/payouts/seller/${seller.id}/summary`).expect(200);
    expect(before.body.eligibleMinor).toBe('500000');

    await api().post(`/payouts/seller/${seller.id}/request`).expect(400); // no bank account yet
    await api().put(`/payouts/seller/${seller.id}/account`).send({ bankName: 'Test Bank', accountName: 'Seller', accountNumber: '0123456789' }).expect(200);
    await api().put(`/payouts/seller/${seller.id}/account`).send({ bankName: 'Test Bank', accountName: 'Seller', accountNumber: '123' }).expect(400);

    const req = await api().post(`/payouts/seller/${seller.id}/request`).expect(201);
    await api().post(`/payouts/seller/${seller.id}/request`).expect(400); // already in an open request
    expect(await status(paymentId)).toBe(S.RELEASABLE); // nothing is sent before approval

    await api().patch(`/payouts/requests/${req.body.id}/approve`).expect(200);
    await api().patch(`/payouts/requests/${req.body.id}/approve`).expect(400); // decided once
    expect(await status(paymentId)).toBe(S.RELEASED);
    expect(await settlements(paymentId)).toHaveLength(1);

    const after = await api().get(`/payouts/seller/${seller.id}/summary`).expect(200);
    expect(after.body.paidOutMinor).toBe('500000');
    expect(after.body.eligibleMinor).toBe('0');
  });

  it('disputes carry a seller response deadline; only the seller answers, once, and the buyer sees it', async () => {
    const { buyer, seller, paymentId } = await protectedPayment();
    const opened = await api().post('/disputes').send({ paymentId, openedById: buyer.id, reason: 'Item not received' }).expect(201);
    expect(new Date(opened.body.sellerResponseDueAt).getTime()).toBeGreaterThan(Date.now() + 47 * 3_600_000);

    await api().post(`/disputes/${opened.body.id}/respond`).send({ userId: buyer.id, response: 'I am the buyer' }).expect(403);
    await api().post(`/disputes/${opened.body.id}/respond`).send({ userId: seller.id, response: 'ok' }).expect(400); // too short
    const answered = await api()
      .post(`/disputes/${opened.body.id}/respond`)
      .send({ userId: seller.id, response: 'Shipped on Monday, waybill attached to the order.' })
      .expect(201);
    expect(answered.body.status).toBe('UNDER_REVIEW');
    await api().post(`/disputes/${opened.body.id}/respond`).send({ userId: seller.id, response: 'Second answer attempt' }).expect(400);

    const seen = await api().get(`/disputes/by-payment/${paymentId}`).expect(200);
    expect(seen.body.sellerResponse).toContain('Shipped on Monday');
    // An admin can still decide an under-review dispute.
    await api().patch(`/disputes/${opened.body.id}/resolve-buyer`).send({ resolvedById: 'admin', notes: 'Refund the buyer' }).expect(200);
  });

  describe('product photos', () => {
    // A valid 1x1 PNG.
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    async function sellerWithProduct() {
      const seller = await newUser('photog');
      await ds.getRepository(User).update(seller.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
      const product = await api().post('/products').send({ sellerId: seller.id, title: 'Photographed', priceMinor: '100000' }).expect(201);
      return { seller, product: product.body as { id: string; slug: string } };
    }

    it('stores a photo, serves its exact bytes, lists it on the product, and removes it', async () => {
      const { product } = await sellerWithProduct();
      const up = await api().post(`/products/${product.id}/images`).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);

      const served = await api().get(`/products/images/${up.body.id}`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(served.status).toBe(200);
      expect(served.headers['content-type']).toContain('image/png');
      expect(Buffer.compare(served.body as Buffer, PNG)).toBe(0);

      const listed = await api().get(`/products/${product.slug}`).expect(200);
      expect(listed.body.images.map((i: { id: string }) => i.id)).toEqual([up.body.id]);
      expect(JSON.stringify(listed.body)).not.toContain('"data"'); // the bytes never travel with the product

      await api().delete(`/products/${product.id}/images/${up.body.id}`).expect(200);
      await api().get(`/products/images/${up.body.id}`).expect(404);
    });

    it('refuses files that are not real photos, whatever they are called', async () => {
      const { product } = await sellerWithProduct();
      await api().post(`/products/${product.id}/images`).attach('file', Buffer.from('<svg onload=alert(1)></svg>'), { filename: 'a.png', contentType: 'image/png' }).expect(400);
      await api().post(`/products/${product.id}/images`).attach('file', Buffer.from('not an image at all'), { filename: 'b.jpg', contentType: 'image/jpeg' }).expect(400);
      await api().post(`/products/${product.id}/images`).expect(400); // no file
    });

    it('limits size and number of photos, and the cover can be changed', async () => {
      const { product } = await sellerWithProduct();
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
      await api().post(`/products/${product.id}/images`).attach('file', big, { filename: 'big.png', contentType: 'image/png' }).expect(413);

      const ids: string[] = [];
      for (let i = 0; i < 8; i++) {
        const r = await api().post(`/products/${product.id}/images`).attach('file', PNG, { filename: `${i}.png`, contentType: 'image/png' }).expect(201);
        ids.push(r.body.id);
      }
      await api().post(`/products/${product.id}/images`).attach('file', PNG, { filename: '9.png', contentType: 'image/png' }).expect(400);

      await api().patch(`/products/${product.id}/images/${ids[5]}/cover`).expect(200);
      const after = await api().get(`/products/${product.slug}`).expect(200);
      const sorted = [...after.body.images].sort((a: { position: number }, b: { position: number }) => a.position - b.position);
      expect(sorted[0].id).toBe(ids[5]);
    });
  });

  describe('input validation', () => {
    it('refuses malformed requests before they reach any logic', async () => {
      await api().post('/users').send({ email: 'not-an-email', fullName: 'X' }).expect(400);
      await api().post('/users').send({ email: `ok-${stamp()}@example.com`, fullName: '' }).expect(400);
      await api().post('/auth/request-code').send({ email: 'nope' }).expect(400);
      await api().post('/auth/verify').send({ email: 'a@example.com', code: '12' }).expect(400);
      await api().post('/disputes').send({ paymentId: 'not-a-uuid', reason: 'x' }).expect(400);
    });

    it('rejects bad quantities, prices and over-long text', async () => {
      const buyer = await newUser('buyer');
      const seller = await newUser('seller');
      await ds.getRepository(User).update(seller.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
      await api().post('/products').send({ sellerId: seller.id, title: 'Free item', priceMinor: '0' }).expect(400);
      await api().post('/products').send({ sellerId: seller.id, title: 'Neg', priceMinor: '-5' }).expect(400);
      await api().post('/products').send({ sellerId: seller.id, title: 'x'.repeat(201), priceMinor: '100' }).expect(400);
      const product = await api().post('/products').send({ sellerId: seller.id, title: 'Fine', priceMinor: '100' }).expect(201);
      for (const quantity of [0, -1, 1.5, '2', 100000]) {
        await api()
          .post('/orders')
          .send({ buyerId: buyer.id, sellerId: seller.id, items: [{ productId: product.body.id, quantity }] })
          .expect(400);
      }
    });

    it('ignores fields it does not know about, including roles on sign-up', async () => {
      const r = await api()
        .post('/users')
        .send({ email: `x-${stamp()}@example.com`, fullName: 'Extra', roles: ['ADMIN'], sellerStatus: 'APPROVED', isAdmin: true })
        .expect(201);
      expect(r.body.roles).toEqual(['BUYER']);
      expect(r.body.sellerStatus).toBe('NONE');
    });

    it('never returns a password hash', async () => {
      const u = await newUser('safe');
      const res = await api().get(`/users/${u.id}`).expect(200);
      expect(Object.keys(res.body)).not.toContain('passwordHash');
    });
  });

  it('records sensitive changes in the audit log', async () => {
    const { seller } = await protectedPayment();
    await api().put(`/payouts/seller/${seller.id}/account`).send({ bankName: 'Test Bank', accountName: 'Seller', accountNumber: '0123456789' }).expect(200);
    await api().put(`/payouts/seller/${seller.id}/account`).send({ bankName: 'Other Bank', accountName: 'Seller', accountNumber: '9876543210' }).expect(200);
    const rows: Array<{ action: string; details: { last4: string } }> = await ds.query(
      `SELECT action, details FROM audit_logs WHERE "targetId" = $1 ORDER BY "createdAt"`,
      [seller.id],
    );
    expect(rows.map((r) => r.action)).toEqual(['PAYOUT_ACCOUNT_SET', 'PAYOUT_ACCOUNT_CHANGED']);
    expect(JSON.stringify(rows)).not.toContain('0123456789'); // the full number is never written to the log
  });

  describe('when sign-in is enforced', () => {
    beforeAll(() => {
      process.env.AUTH_ENFORCED = 'true';
    });
    afterAll(() => {
      process.env.AUTH_ENFORCED = 'false';
    });

    async function login(email: string): Promise<string> {
      const r = await api().post('/auth/request-code').send({ email }).expect(201);
      expect(r.body.devCode).toMatch(/^\d{6}$/);
      const v = await api().post('/auth/verify').send({ email, code: r.body.devCode }).expect(201);
      return v.body.token as string;
    }

    it('rejects requests with no token or a bad token', async () => {
      await api().get('/orders?buyerId=someone').expect(401);
      await api().get('/orders?buyerId=someone').set('Authorization', 'Bearer not.a.token').expect(401);
    });

    it('registration ignores any roles in the request, and a wrong code does not sign in', async () => {
      const email = `sneaky-${stamp()}@example.com`;
      const r = await api().post('/users').send({ email, fullName: 'Sneaky', roles: ['ADMIN', 'SELLER'] }).expect(201);
      expect(r.body.roles).toEqual(['BUYER']);
      await api().post('/auth/request-code').send({ email }).expect(201);
      await api().post('/auth/verify').send({ email, code: '000000' }).expect(401);
    });

    it('keeps one person away from another person\'s orders, and sellers-only and admin-only actions', async () => {
      const a = await newUser('alice');
      const b = await newUser('bob');
      const tokenA = await login(a.email);

      await api().get(`/orders?buyerId=${a.id}`).set('Authorization', `Bearer ${tokenA}`).expect(200);
      await api().get(`/orders?buyerId=${b.id}`).set('Authorization', `Bearer ${tokenA}`).expect(403);
      await api()
        .post('/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sellerId: a.id, title: 'x', priceMinor: '100' })
        .expect(403); // not an approved seller
      await api().get('/disputes').set('Authorization', `Bearer ${tokenA}`).expect(403);
      await api().get('/sellers/applications').set('Authorization', `Bearer ${tokenA}`).expect(403);
      await api().get(`/users/${b.id}`).set('Authorization', `Bearer ${tokenA}`).expect(200).expect((res: { body: Record<string, unknown> }) => {
        expect(res.body.email).toBeUndefined(); // other people's accounts show a name only
      });
    });

    it('only the owner can add or remove photos on a product', async () => {
      const owner = await newUser('owner');
      const other = await newUser('other');
      await ds.getRepository(User).update(owner.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
      await ds.getRepository(User).update(other.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
      const ownerToken = await login(owner.email);
      const otherToken = await login(other.email);
      const product = await api()
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ sellerId: owner.id, title: 'Mine', priceMinor: '100' })
        .expect(201);
      const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      await api().post(`/products/${product.body.id}/images`).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(401);
      await api().post(`/products/${product.body.id}/images`).set('Authorization', `Bearer ${otherToken}`).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(403);
      await api().post(`/products/${product.body.id}/images`).set('Authorization', `Bearer ${ownerToken}`).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    });

    it('a seller does not see who the buyer is until they accept the order', async () => {
      const buyer = await newUser('shopper');
      const seller = await newUser('vendor');
      await ds.getRepository(User).update(seller.id, { roles: [UserRole.BUYER, UserRole.SELLER] });
      const buyerToken = await login(buyer.email);
      const sellerToken = await login(seller.email);
      const product = await api()
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ sellerId: seller.id, title: 'Thing', priceMinor: '100000' })
        .expect(201);
      const created = await api()
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          buyerId: buyer.id,
          sellerId: seller.id,
          items: [{ productId: product.body.id, quantity: 1 }],
          deliveryAddress: { recipientName: 'Ada Obi', phone: '08012345678', street: '14 Faulks Road', city: 'Aba', state: 'Abia' },
        })
        .expect(201);
      const orderId = created.body.order.id;
      await api()
        .post('/webhooks/palmpay')
        .send({ eventId: `evt-${orderId}`, eventType: 'payment.confirmed', providerTransactionRef: created.body.payment.providerTransactionRef })
        .expect(201);

      const before = await api().get(`/orders/${orderId}`).set('Authorization', `Bearer ${sellerToken}`).expect(200);
      expect(before.body.deliveryAddress).toEqual({ state: 'Abia', city: 'Aba' });
      const list = await api().get(`/orders?sellerId=${seller.id}`).set('Authorization', `Bearer ${sellerToken}`).expect(200);
      expect(JSON.stringify(list.body)).not.toContain('08012345678');
      const asBuyer = await api().get(`/orders/${orderId}`).set('Authorization', `Bearer ${buyerToken}`).expect(200);
      expect(asBuyer.body.deliveryAddress.phone).toBe('08012345678'); // the buyer still sees their own details

      await api().patch(`/orders/${orderId}/accept`).set('Authorization', `Bearer ${sellerToken}`).expect(200);
      const after = await api().get(`/orders/${orderId}`).set('Authorization', `Bearer ${sellerToken}`).expect(200);
      expect(after.body.deliveryAddress.phone).toBe('08012345678');
    });

    it('seller applications: apply, admin approves, seller tools unlock', async () => {
      const seller = await newUser('shopper');
      const admin = await newUser('boss');
      process.env.ADMIN_EMAILS = admin.email;
      const sellerToken = await login(seller.email);
      const adminToken = await login(admin.email);

      await api()
        .post('/sellers/apply')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ businessName: 'Shop', storeState: 'Lagos' })
        .expect(201);
      await api().patch(`/sellers/${seller.id}/approve`).set('Authorization', `Bearer ${sellerToken}`).expect(403);
      await api().patch(`/sellers/${seller.id}/approve`).set('Authorization', `Bearer ${adminToken}`).expect(200);
      await api()
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ sellerId: seller.id, title: 'Now allowed', priceMinor: '100' })
        .expect(201);
    });
  });
});
