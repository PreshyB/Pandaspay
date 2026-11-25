import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { corsOrigins, securityHeaders } from './common/security';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable('x-powered-by');
  // Behind a load balancer, set TRUST_PROXY (for example 1) so rate limits see the real client address.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
  }
  app.use(securityHeaders);
  app.enableCors({ origin: corsOrigins() });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`PayTight backend listening on :${port}`);
}
bootstrap();
