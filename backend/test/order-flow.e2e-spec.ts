import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PaymentProtectionStatus } from '../src/common/enums/payment-protection-status.enum';
import { OrderStatus } from '../src/common/enums/order-status.enum';
import { PaymentsService } from '../src/payments/payments.service';
import { DataSource } from 'typeorm';
import { Payment } from '../src/payments/entities/payment.entity';
import { Settlement } from '../src/payments/entities/settlement.entity';

/**
 * End-to-end slice proving the architecture works, per the agreed first
 * milestone: buyer places an order -> payment (mocked PalmPay) ->
 * protection status -> seller ships -> buyer confirms -> funds releasable
 * -> settlement job releases.
 *
 * Requires a real Postgres reachable via DATABASE_URL / DB_* env vars
 * (docker-compose.yml brings one up: `docker compose up -d`), because the
 * entities use Postgres-specific types (enum columns, jsonb, timestamptz)
 * that sqlite cannot faithfully stand in for.
 */
describe('Order -> Payment Protection flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let paymentsService: PaymentsService;

  beforeAll(async () => {
    process.env.DB_SYNCHRONIZE = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    paymentsService = app.get(PaymentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('walks a single order through the full happy path', async () => {
    const buyer = await request(app.getHttpServer())
      .post('/users')
      .send({ email: `buyer-${Date.now()}@example.com`, fullName: 'Ada Buyer' })
      .expect(201);

    const seller = await request(app.getHttpServer())
      .post('/users')
      .send({ email: `seller-${Date.now()}@example.com`, fullName: 'Chinedu Seller' })
      .expect(201);

    const product = await request(app.getHttpServer())
      .post('/products')
      .send({ sellerId: seller.body.id, title: 'Ankara fabric, 6 yards', priceMinor: '1500000' })
      .expect(201);

    // 1. Buyer places an order.
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send({
        buyerId: buyer.body.id,
        sellerId: seller.body.id,
        items: [{ productId: product.body.id, quantity: 1 }],
      })
      .expect(201);

    expect(created.body.order.status).toBe(OrderStatus.CREATED);
    expect(created.body.payment.protectionStatus).toBe(PaymentProtectionStatus.AWAITING_PAYMENT);
    const orderId = created.body.order.id;
    const providerTransactionRef = created.body.payment.providerTransactionRef;

    // 2. The licensed partner's webhook confirms payment (mocked PalmPay).
    await request(app.getHttpServer())
      .post('/webhooks/palmpay')
      .send({ eventId: `evt-${orderId}-confirmed`, eventType: 'payment.confirmed', providerTransactionRef })
      .expect(201);

    const paymentAfterConfirm = await dataSource.getRepository(Payment).findOneByOrFail({ orderId });
    expect(paymentAfterConfirm.protectionStatus).toBe(PaymentProtectionStatus.PROTECTED);

    // A redelivered webhook must be a no-op (idempotency, spec §7).
    await request(app.getHttpServer())
      .post('/webhooks/palmpay')
      .send({ eventId: `evt-${orderId}-confirmed`, eventType: 'payment.confirmed', providerTransactionRef })
      .expect(201);
    const paymentAfterRedelivery = await dataSource.getRepository(Payment).findOneByOrFail({ orderId });
    expect(paymentAfterRedelivery.protectionStatus).toBe(PaymentProtectionStatus.PROTECTED);

    // 3. Seller accepts (now allowed, payment is PROTECTED).
    await request(app.getHttpServer()).patch(`/orders/${orderId}/accept`).expect(200);

    // 4. Seller ships.
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/ship`)
      .send({ waybillRef: 'DHL-TEST-001' })
      .expect(200);

    // 5. Buyer confirms delivery — starts the protection countdown.
    const delivered = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/delivered`)
      .send({ confirmedBy: 'BUYER' })
      .expect(200);
    expect(delivered.body.status).toBe(OrderStatus.DELIVERED);
    expect(delivered.body.deliveryConfirmedBy).toBe('BUYER');

    // 6. Protection window elapses with no dispute -> RELEASABLE.
    const payment = await dataSource.getRepository(Payment).findOneByOrFail({ orderId });
    await paymentsService.markReleasable(payment.id);
    const releasable = await dataSource.getRepository(Payment).findOneByOrFail({ orderId });
    expect(releasable.protectionStatus).toBe(PaymentProtectionStatus.RELEASABLE);

    // 7. Settlement job releases funds (disposition lock acquired, payout instruction sent).
    const released = await paymentsService.release(payment.id, { bankAccount: 'mock-seller-account' });
    expect(released.protectionStatus).toBe(PaymentProtectionStatus.RELEASED);

    // Settlement row recorded.
    const settlements = await dataSource.getRepository(Settlement).find({ where: { paymentId: payment.id } });
    expect(settlements).toHaveLength(1);
    expect(settlements[0].kind).toBe('PAYOUT');
  });

  it('disposition lock: a second release attempt on an already-RELEASED payment is rejected, not double-paid', async () => {
    const buyer = await request(app.getHttpServer())
      .post('/users')
      .send({ email: `buyer2-${Date.now()}@example.com`, fullName: 'Buyer Two' })
      .expect(201);
    const seller = await request(app.getHttpServer())
      .post('/users')
      .send({ email: `seller2-${Date.now()}@example.com`, fullName: 'Seller Two' })
      .expect(201);
    const product = await request(app.getHttpServer())
      .post('/products')
      .send({ sellerId: seller.body.id, title: 'Test item', priceMinor: '500000' })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send({ buyerId: buyer.body.id, sellerId: seller.body.id, items: [{ productId: product.body.id, quantity: 1 }] })
      .expect(201);

    const paymentId = created.body.payment.id;
    await dataSource
      .getRepository(Payment)
      .update(paymentId, { protectionStatus: PaymentProtectionStatus.RELEASABLE });

    await paymentsService.release(paymentId, { bankAccount: 'acct-1' });

    await expect(paymentsService.release(paymentId, { bankAccount: 'acct-1' })).rejects.toThrow();

    const settlements = await dataSource.getRepository(Settlement).find({ where: { paymentId } });
    expect(settlements).toHaveLength(1); // never two payouts for one disposition
  });
});
