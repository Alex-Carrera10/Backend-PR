import type { TaskRepository } from '../../domain/ports/TaskRepository.js';
import type { Task } from '../../domain/entities/Task.js';
import { ValidationError } from '../../domain/errors/AppError.js';

export interface CreateTaskInput {
  title?: unknown;
  description?: unknown;
}

export class CreateTaskUseCase {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: CreateTaskInput): Promise<Task> {
    const { title, description } = input;

    if (typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('El campo "title" es obligatorio.');
    }
    if (typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('El campo "description" es obligatorio.');
    }

    return this.tasks.create({
      title: title.trim(),
      description: description.trim(),
    });
  }
}
