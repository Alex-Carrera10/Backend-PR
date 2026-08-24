export interface NotificationAttempt {
  id: number;
  taskId: number;
  attemptNumber: number;
  statusCode: number | null;
  succeeded: boolean;
  errorMessage: string | null;
  attemptedAt: Date;
}
