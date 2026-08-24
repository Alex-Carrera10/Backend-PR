import { Router } from 'express';
import type { UserController } from './controllers/UserController.js';
import type { TaskController } from './controllers/TaskController.js';
import type { IdempotencyStore } from '../../domain/ports/IdempotencyStore.js';
import { idempotencyMiddleware } from './idempotencyMiddleware.js';

export function buildRouter(
  userController: UserController,
  taskController: TaskController,
  idempotencyStore: IdempotencyStore,
): Router {
  const router = Router();
  const idempotent = idempotencyMiddleware(idempotencyStore);

  router.post('/users', idempotent, userController.create);
  router.get('/users', userController.list);
  router.get('/users/:idUser/tasks', userController.tasksForUser);

  router.post('/tasks', idempotent, taskController.create);
  router.post('/tasks/:idTask/assign', idempotent, taskController.assign);
  router.post('/tasks/:idTask/complete', idempotent, taskController.complete);
  router.get('/tasks', taskController.list);
  router.get('/tasks/:idTask', taskController.getOne);
  router.get('/tasks/:idTask/notifications', taskController.notifications);

  return router;
}
