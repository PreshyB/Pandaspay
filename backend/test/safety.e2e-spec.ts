import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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
      await api().get(`/users/${b.id}`).set('Authorization', `Bearer ${tokenA}`).expect(200).expect((res) => {
        expect(res.body.email).toBeUndefined(); // other people's accounts show a name only
      });
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
