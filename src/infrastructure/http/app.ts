import express, { type Express } from 'express';
import { buildRouter } from './routes.js';
import { errorHandler } from './errorHandler.js';
import { createRateLimiter } from './rateLimiter.js';
import type { UserController } from './controllers/UserController.js';
import type { TaskController } from './controllers/TaskController.js';
import type { IdempotencyStore } from '../../domain/ports/IdempotencyStore.js';

export function buildApp(
  userController: UserController,
  taskController: TaskController,
  idempotencyStore: IdempotencyStore,
): Express {
  const app = express();
  app.set('trust proxy', true);

  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const rateLimiter = createRateLimiter(rateLimitMax, rateLimitWindowMs);

  app.use(express.json());
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.use('/', rateLimiter, buildRouter(userController, taskController, idempotencyStore));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } });
  });

  app.use(errorHandler);

  return app;
}
