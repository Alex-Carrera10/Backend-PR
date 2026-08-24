import type { TaskRepository } from '../../domain/ports/TaskRepository.js';
import { ValidationError } from '../../domain/errors/AppError.js';

export interface AssignUsersInput {
  userIds?: unknown;
}

export class AssignUsersToTaskUseCase {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(taskId: number, input: AssignUsersInput): Promise<void> {
    const { userIds } = input;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('El campo "userIds" es obligatorio y debe ser un arreglo no vacío.');
    }
    if (!userIds.every((id) => typeof id === 'number' && Number.isInteger(id))) {
      throw new ValidationError('Todos los valores de "userIds" deben ser números enteros.');
    }

    await this.tasks.assignUsers(taskId, userIds);
  }
}
