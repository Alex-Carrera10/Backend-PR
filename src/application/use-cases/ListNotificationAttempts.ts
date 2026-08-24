import type { TaskRepository } from '../../domain/ports/TaskRepository.js';
import type { NotificationAttemptRepository } from '../../domain/ports/NotificationAttemptRepository.js';
import type { NotificationAttempt } from '../../domain/entities/NotificationAttempt.js';
import { NotFoundError } from '../../domain/errors/AppError.js';

export class ListNotificationAttemptsUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly notificationAttempts: NotificationAttemptRepository,
  ) {}

  async execute(taskId: number): Promise<NotificationAttempt[]> {
    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new NotFoundError(`No existe una tarea con id ${taskId}.`);
    }
    return this.notificationAttempts.listByTask(taskId);
  }
}
