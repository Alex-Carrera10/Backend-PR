export interface Assignment {
  taskId: number;
  userId: number;
  assignedAt: Date;
  completedAt: Date | null;
}
