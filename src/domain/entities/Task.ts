export type TaskStatus = 'open' | 'archived';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: Date;
  archivedAt: Date | null;
}
