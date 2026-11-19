import { corsOrigins, securityHeaders } from './security';

describe('security helpers', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('sets the protective headers and never lets responses be cached', () => {
    const headers: Record<string, string> = {};
    const next = jest.fn();
    securityHeaders({} as never, { setHeader: (k: string, v: string) => (headers[k] = v) } as never, next);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(next).toHaveBeenCalled();
  });

  it('only adds HSTS in production', () => {
    const run = () => {
      const h: Record<string, string> = {};
      securityHeaders({} as never, { setHeader: (k: string, v: string) => (h[k] = v) } as never, () => undefined);
      return h['Strict-Transport-Security'];
    };
    process.env.NODE_ENV = 'development';
    expect(run()).toBeUndefined();
    process.env.NODE_ENV = 'production';
    expect(run()).toContain('max-age');
  });

  it('CORS: open in dev, closed in production unless origins are listed', () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'development';
    expect(corsOrigins()).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(corsOrigins()).toBe(false);
    process.env.CORS_ORIGINS = 'https://paytight.example, https://www.paytight.example';
    expect(corsOrigins()).toEqual(['https://paytight.example', 'https://www.paytight.example']);
  });
});
