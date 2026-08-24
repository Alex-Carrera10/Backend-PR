import type { UserRepository } from '../../domain/ports/UserRepository.js';
import type { TaskRepository } from '../../domain/ports/TaskRepository.js';
import type { User } from '../../domain/entities/User.js';
import type { Task } from '../../domain/entities/Task.js';

export interface UserWithPendingTasks extends User {
  pendingTasks: Task[];
}

export class ListUsersUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(): Promise<UserWithPendingTasks[]> {
    const allUsers = await this.users.list();

    return Promise.all(
      allUsers.map(async (user) => {
        const userTasks = await this.tasks.getTasksForUser(user.id);
        const pendingTasks = userTasks.filter((t) => !t.completed).map((t) => t.task);
        return { ...user, pendingTasks };
      }),
    );
  }
}
