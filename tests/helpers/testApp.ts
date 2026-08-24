import 'dotenv/config';
import type { Express } from 'express';
import { pool } from '../../src/infrastructure/db/pool.js';
import { PgUserRepository } from '../../src/infrastructure/repositories/PgUserRepository.js';
import { PgTaskRepository } from '../../src/infrastructure/repositories/PgTaskRepository.js';
import { PgNotificationAttemptRepository } from '../../src/infrastructure/repositories/PgNotificationAttemptRepository.js';
import { PgIdempotencyStore } from '../../src/infrastructure/repositories/PgIdempotencyStore.js';
import { FakeNotificationSender } from './FakeNotificationSender.js';

import { CreateUserUseCase } from '../../src/application/use-cases/CreateUser.js';
import { CreateTaskUseCase } from '../../src/application/use-cases/CreateTask.js';
import { AssignUsersToTaskUseCase } from '../../src/application/use-cases/AssignUsersToTask.js';
import { CompleteTaskForUserUseCase } from '../../src/application/use-cases/CompleteTaskForUser.js';
import { ListTasksUseCase } from '../../src/application/use-cases/ListTasks.js';
import { ListUsersUseCase } from '../../src/application/use-cases/ListUsers.js';
import { GetUserTasksUseCase } from '../../src/application/use-cases/GetUserTasks.js';
import { GetTaskUseCase } from '../../src/application/use-cases/GetTask.js';
import { ListNotificationAttemptsUseCase } from '../../src/application/use-cases/ListNotificationAttempts.js';

import { UserController } from '../../src/infrastructure/http/controllers/UserController.js';
import { TaskController } from '../../src/infrastructure/http/controllers/TaskController.js';
import { buildApp } from '../../src/infrastructure/http/app.js';

export interface TestContext {
  app: Express;
  notifier: FakeNotificationSender;
}

export function buildTestApp(): TestContext {
  const userRepository = new PgUserRepository(pool);
  const taskRepository = new PgTaskRepository(pool);
  const notificationAttemptRepository = new PgNotificationAttemptRepository(pool);
  const idempotencyStore = new PgIdempotencyStore(pool);
  const notifier = new FakeNotificationSender();

  const userController = new UserController(
    new CreateUserUseCase(userRepository),
    new ListUsersUseCase(userRepository, taskRepository),
    new GetUserTasksUseCase(userRepository, taskRepository),
  );

  const taskController = new TaskController(
    new CreateTaskUseCase(taskRepository),
    new AssignUsersToTaskUseCase(taskRepository),
    new CompleteTaskForUserUseCase(taskRepository, notifier, notificationAttemptRepository),
    new ListTasksUseCase(taskRepository),
    new GetTaskUseCase(taskRepository),
    new ListNotificationAttemptsUseCase(taskRepository, notificationAttemptRepository),
  );

  const app = buildApp(userController, taskController, idempotencyStore);
  return { app, notifier };
}
