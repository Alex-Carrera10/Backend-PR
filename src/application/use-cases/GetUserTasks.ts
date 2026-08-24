import type { UserRepository } from '../../domain/ports/UserRepository.js';
import type { TaskRepository, UserTaskView } from '../../domain/ports/TaskRepository.js';
import { NotFoundError } from '../../domain/errors/AppError.js';

export class GetUserTasksUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(userId: number): Promise<UserTaskView[]> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`No existe un usuario con id ${userId}.`);
    }
    return this.tasks.getTasksForUser(userId);
  }
}
