import type { TaskRepository, TaskDetail } from '../../domain/ports/TaskRepository.js';
import type { TaskStatus } from '../../domain/entities/Task.js';
import { ValidationError } from '../../domain/errors/AppError.js';

const VALID_STATUSES: TaskStatus[] = ['open', 'archived'];

export class ListTasksUseCase {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(status?: unknown): Promise<TaskDetail[]> {
    if (status === undefined) return this.tasks.list();

    if (typeof status !== 'string' || !VALID_STATUSES.includes(status as TaskStatus)) {
      throw new ValidationError('El parámetro "status" debe ser "open" o "archived".');
    }

    return this.tasks.list(status as TaskStatus);
  }
}
