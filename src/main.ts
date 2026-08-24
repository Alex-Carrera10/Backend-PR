import 'dotenv/config';
import { pool } from './infrastructure/db/pool.js';
import { PgUserRepository } from './infrastructure/repositories/PgUserRepository.js';
import { PgTaskRepository } from './infrastructure/repositories/PgTaskRepository.js';
import { PgNotificationAttemptRepository } from './infrastructure/repositories/PgNotificationAttemptRepository.js';
import { PgIdempotencyStore } from './infrastructure/repositories/PgIdempotencyStore.js';
import { HttpNotificationSender } from './infrastructure/notifications/HttpNotificationSender.js';

import { CreateUserUseCase } from './application/use-cases/CreateUser.js';
import { CreateTaskUseCase } from './application/use-cases/CreateTask.js';
import { AssignUsersToTaskUseCase } from './application/use-cases/AssignUsersToTask.js';
import { CompleteTaskForUserUseCase } from './application/use-cases/CompleteTaskForUser.js';
import { ListTasksUseCase } from './application/use-cases/ListTasks.js';
import { ListUsersUseCase } from './application/use-cases/ListUsers.js';
import { GetUserTasksUseCase } from './application/use-cases/GetUserTasks.js';
import { GetTaskUseCase } from './application/use-cases/GetTask.js';
import { ListNotificationAttemptsUseCase } from './application/use-cases/ListNotificationAttempts.js';

import { UserController } from './infrastructure/http/controllers/UserController.js';
import { TaskController } from './infrastructure/http/controllers/TaskController.js';
import { buildApp } from './infrastructure/http/app.js';

const notifyUrl = process.env.NOTIFY_URL;
if (!notifyUrl) {
  throw new Error('Falta la variable de entorno NOTIFY_URL.');
}

const userRepository = new PgUserRepository(pool);
const taskRepository = new PgTaskRepository(pool);
const notificationAttemptRepository = new PgNotificationAttemptRepository(pool);
const idempotencyStore = new PgIdempotencyStore(pool);
const notificationSender = new HttpNotificationSender(notifyUrl);

const userController = new UserController(
  new CreateUserUseCase(userRepository),
  new ListUsersUseCase(userRepository, taskRepository),
  new GetUserTasksUseCase(userRepository, taskRepository),
);

const taskController = new TaskController(
  new CreateTaskUseCase(taskRepository),
  new AssignUsersToTaskUseCase(taskRepository),
  new CompleteTaskForUserUseCase(taskRepository, notificationSender, notificationAttemptRepository),
  new ListTasksUseCase(taskRepository),
  new GetTaskUseCase(taskRepository),
  new ListNotificationAttemptsUseCase(taskRepository, notificationAttemptRepository),
);

const app = buildApp(userController, taskController, idempotencyStore);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
