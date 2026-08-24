import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/infrastructure/http/rateLimiter.js';

function buildLimitedApp(max: number, windowMs: number) {
  const app = express();
  app.use(createRateLimiter(max, windowMs));
  app.get('/ping', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('rate limiter', () => {
  it('permite requests dentro del límite', async () => {
    const app = buildLimitedApp(3, 60_000);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  });

  it('responde 429 al superar el límite dentro de la ventana', async () => {
    const app = buildLimitedApp(2, 60_000);

    await request(app).get('/ping');
    await request(app).get('/ping');
    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('reinicia el conteo una vez pasada la ventana', async () => {
    const app = buildLimitedApp(1, 200);

    const first = await request(app).get('/ping');
    expect(first.status).toBe(200);

    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const afterWindow = await request(app).get('/ping');
    expect(afterWindow.status).toBe(200);
  });
});
