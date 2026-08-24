import type { TaskRepository, TaskDetail } from '../../domain/ports/TaskRepository.js';
import { NotFoundError } from '../../domain/errors/AppError.js';

export class GetTaskUseCase {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(taskId: number): Promise<TaskDetail> {
    const task = await this.tasks.getDetail(taskId);
    if (!task) {
      throw new NotFoundError(`No existe una tarea con id ${taskId}.`);
    }
    return task;
  }
}
