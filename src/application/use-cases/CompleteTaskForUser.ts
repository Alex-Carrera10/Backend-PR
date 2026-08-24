import type { TaskRepository } from '../../domain/ports/TaskRepository.js';
import type { NotificationSender } from '../../domain/ports/NotificationSender.js';
import type { NotificationAttemptRepository } from '../../domain/ports/NotificationAttemptRepository.js';
import type { Task } from '../../domain/entities/Task.js';
import { ValidationError } from '../../domain/errors/AppError.js';

export interface CompleteTaskInput {
  userId?: unknown;
}

const RETRY_DELAYS_MS = [0, 500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CompleteTaskForUserUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly notifier: NotificationSender,
    private readonly notificationAttempts: NotificationAttemptRepository,
  ) {}

  async execute(taskId: number, input: CompleteTaskInput): Promise<Task> {
    const { userId } = input;
    if (typeof userId !== 'number' || !Number.isInteger(userId)) {
      throw new ValidationError('El campo "userId" es obligatorio y debe ser un número entero.');
    }

    const result = await this.tasks.completeForUser(taskId, userId);

    if (result.justArchived) {
      // Se dispara sin esperar la respuesta: los reintentos con backoff no deben
      // bloquear la respuesta HTTP de "complete". El intento queda registrado
      // en notification_attempts de forma independiente.
      void this.sendNotificationWithRetries(result.task);
    }

    return result.task;
  }

  private async sendNotificationWithRetries(task: Task): Promise<void> {
    const payload = {
      taskId: task.id,
      title: task.title,
      archivedAt: (task.archivedAt ?? new Date()).toISOString(),
    };

    for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 0;
      if (delay > 0) await sleep(delay);

      const result = await this.notifier.send(payload);

      await this.notificationAttempts.record({
        taskId: task.id,
        attemptNumber: attempt,
        statusCode: result.statusCode,
        succeeded: result.ok,
        errorMessage: result.errorMessage,
        attemptedAt: new Date(),
      });

      if (result.ok) return;
    }
  }
}
