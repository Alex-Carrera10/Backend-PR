import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import type { IdempotencyStore } from '../../domain/ports/IdempotencyStore.js';

/**
 * Todas las respuestas para una misma Idempotency-Key deben ser idénticas,
 * incluso si dos requests llegan en paralelo. La reserva de la clave usa una
 * escritura atómica en la base (constraint UNIQUE); quien pierde la carrera
 * espera (polling) a que el ganador termine y reutiliza su respuesta.
 */
export function idempotencyMiddleware(store: IdempotencyStore): RequestHandler {
  return (req, res, next) => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }

    const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    store
      .begin(key, req.method, req.originalUrl, requestHash)
      .then(async (result) => {
        if (result.status === 'existing') {
          res.status(result.record.statusCode).json(result.record.responseBody);
          return;
        }

        if (result.status === 'in_progress') {
          const record = await store.waitForCompletion(key);
          res.status(record.statusCode).json(record.responseBody);
          return;
        }

        const originalJson = res.json.bind(res);
        res.json = ((body: unknown) => {
          void store.complete(key, res.statusCode, body);
          return originalJson(body);
        }) as typeof res.json;

        next();
      })
      .catch(next);
  };
}
