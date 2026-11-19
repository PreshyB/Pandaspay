import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Counts hits per key in fixed time windows. In memory, so each server instance counts separately (move to Redis when scaling out). */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  /** Returns 0 when allowed, otherwise the seconds to wait. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): number {
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return 0;
    }
    entry.count += 1;
    return entry.count > limit ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
  }
}

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Per-IP limits. Sign-in and sign-up are the tight ones, since they can be used to guess codes or spam inboxes.
 * Provider webhooks are exempt (they are authenticated by signature instead). Off under test.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new FixedWindowLimiter();

  canActivate(ctx: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true') return true;
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const path: string = (req.path ?? req.url ?? '').split('?')[0];
    if (path.startsWith('/webhooks')) return true;

    let bucket = 'general';
    let limit = num(process.env.RATE_LIMIT_PER_MINUTE, 300);
    if (path.startsWith('/auth')) {
      bucket = 'auth';
      limit = num(process.env.AUTH_RATE_LIMIT_PER_MINUTE, 20);
    } else if (req.method === 'POST' && path === '/users') {
      bucket = 'signup';
      limit = num(process.env.SIGNUP_RATE_LIMIT_PER_MINUTE, 10);
    }

    const wait = this.limiter.hit(`${bucket}:${req.ip}`, limit, 60_000);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      throw new HttpException('Too many requests. Please slow down and try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
