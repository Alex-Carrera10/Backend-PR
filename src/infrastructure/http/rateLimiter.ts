import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * Rate limiter de ventana fija, en memoria, por IP.
 * Viable porque la API corre como un proceso Node persistente (no serverless):
 * el estado sobrevive entre requests sin necesitar Redis ni almacenamiento externo.
 */
export function createRateLimiter(maxRequests: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Demasiadas solicitudes. Intenta nuevamente en ${retryAfterSeconds}s.`,
        },
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}
