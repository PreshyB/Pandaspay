import type { NextFunction, Request, Response } from 'express';

/** Headers that cost nothing and close off common browser-side attacks. This is an API, so nothing here needs to be framed or sniffed. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  // Responses hold personal and payment details: never let a shared cache keep them.
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

/** Which web origins may call the API from a browser. Open in dev; closed in production unless CORS_ORIGINS lists them. */
export function corsOrigins(): string[] | boolean {
  const list = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (list.length) return list;
  return process.env.NODE_ENV !== 'production';
}
