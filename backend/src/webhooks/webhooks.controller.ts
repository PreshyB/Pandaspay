import { Public } from '../auth/authz';
import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderWebhookEvent } from './entities/provider-webhook-event.entity';
import { PaymentsService } from '../payments/payments.service';
import { Inject } from '@nestjs/common';
import {
  PAYMENT_PROVIDER,
  PaymentProviderService,
} from '../payment-providers/payment-provider.interface';

interface PalmPayWebhookBody {
  eventId: string;
  eventType: 'payment.confirmed' | 'payment.declined' | 'payout.executed' | 'refund.executed';
  providerTransactionRef?: string;
  paymentId?: string;
  [key: string]: unknown;
}

/**
 * Inbound webhooks from the licensed partner. Every transition that
 * originates here must be idempotent against the event's own reference id
 * (spec §7) — provider_webhook_events stores every delivery and a
 * duplicate is recognized and discarded before it can re-trigger anything.
 *
 * Today this is wired to the mock PalmPay provider. Swapping in the real
 * PalmPay integration should only mean: verify the real signature header,
 * and map their real event names/payload shape onto the same
 * PaymentsService calls below.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @InjectRepository(ProviderWebhookEvent) private readonly webhookEvents: Repository<ProviderWebhookEvent>,
    private readonly paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderService,
  ) {}

  @Public() // authenticated by the provider's signature, not a user session
  @Post('palmpay')
  async handlePalmPay(@Body() body: PalmPayWebhookBody, @Headers() headers: Record<string, string>) {
    if (!this.provider.verifyWebhookSignature(JSON.stringify(body), headers)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (!body.eventId || !body.eventType) {
      throw new BadRequestException('eventId and eventType are required');
    }

    const existing = await this.webhookEvents.findOneBy({ providerEventRef: body.eventId });
    if (existing) {
      // Redelivered webhook — already processed (or in flight). No-op.
      return { ok: true, deduplicated: true };
    }

    const event = await this.webhookEvents.save(
      this.webhookEvents.create({
        providerName: this.provider.providerName,
        providerEventRef: body.eventId,
        eventType: body.eventType,
        payload: body as Record<string, unknown>,
      }),
    );

    switch (body.eventType) {
      case 'payment.confirmed':
        if (!body.providerTransactionRef) throw new BadRequestException('providerTransactionRef required');
        await this.paymentsService.confirmProtected(body.providerTransactionRef, event.id);
        break;
      case 'payment.declined':
        if (!body.providerTransactionRef) throw new BadRequestException('providerTransactionRef required');
        await this.paymentsService.declinePayment(body.providerTransactionRef, event.id);
        break;
      case 'refund.executed':
        if (!body.paymentId) throw new BadRequestException('paymentId required');
        await this.paymentsService.confirmRefunded(body.paymentId, event.id);
        break;
      case 'payout.executed':
        // Settlement row already recorded at instruction-send time (spec: Model B
        // records the instruction was sent, then that it was executed). Mark it executed.
        break;
      default:
        throw new BadRequestException(`Unknown event type: ${body.eventType}`);
    }

    event.processed = true;
    event.processedAt = new Date();
    await this.webhookEvents.save(event);

    return { ok: true, deduplicated: false };
  }
}
