import type { NotificationAttempt } from '../entities/NotificationAttempt.js';

export type NewNotificationAttempt = Omit<NotificationAttempt, 'id'>;

export interface NotificationAttemptRepository {
  record(attempt: NewNotificationAttempt): Promise<void>;
  listByTask(taskId: number): Promise<NotificationAttempt[]>;
}
