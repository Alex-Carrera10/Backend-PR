import type { Task, TaskStatus } from '../entities/Task.js';

export interface CreateTaskData {
  title: string;
  description: string | null;
}

export interface TaskAssignmentView {
  userId: number;
  completed: boolean;
}

export interface TaskDetail extends Task {
  assignments: TaskAssignmentView[];
}

export interface UserTaskView {
  task: Task;
  completed: boolean;
}

export interface CompleteResult {
  task: Task;
  justArchived: boolean;
}

export interface TaskRepository {
  create(data: CreateTaskData): Promise<Task>;
  findById(id: number): Promise<Task | null>;
  list(status?: TaskStatus): Promise<TaskDetail[]>;
  getDetail(id: number): Promise<TaskDetail | null>;
  /** Lanza NotFoundError si la tarea o algún usuario no existen. Ignora duplicados. */
  assignUsers(taskId: number, userIds: number[]): Promise<void>;
  /** Marca la parte del usuario como completada. Archiva la tarea de forma atómica si era la última parte pendiente. */
  completeForUser(taskId: number, userId: number): Promise<CompleteResult>;
  getTasksForUser(userId: number): Promise<UserTaskView[]>;
}
