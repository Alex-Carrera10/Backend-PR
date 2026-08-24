import type { Pool } from 'pg';
import type {
  NotificationAttemptRepository,
  NewNotificationAttempt,
} from '../../domain/ports/NotificationAttemptRepository.js';
import type { NotificationAttempt } from '../../domain/entities/NotificationAttempt.js';

interface AttemptRow {
  id: number;
  task_id: number;
  attempt_number: number;
  status_code: number | null;
  succeeded: boolean;
  error_message: string | null;
  attempted_at: Date;
}

function toAttempt(row: AttemptRow): NotificationAttempt {
  return {
    id: row.id,
    taskId: row.task_id,
    attemptNumber: row.attempt_number,
    statusCode: row.status_code,
    succeeded: row.succeeded,
    errorMessage: row.error_message,
    attemptedAt: row.attempted_at,
  };
}

export class PgNotificationAttemptRepository implements NotificationAttemptRepository {
  constructor(private readonly pool: Pool) {}

  async record(attempt: NewNotificationAttempt): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification_attempts (task_id, attempt_number, status_code, succeeded, error_message, attempted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        attempt.taskId,
        attempt.attemptNumber,
        attempt.statusCode,
        attempt.succeeded,
        attempt.errorMessage,
        attempt.attemptedAt,
      ],
    );
  }

  async listByTask(taskId: number): Promise<NotificationAttempt[]> {
    const result = await this.pool.query<AttemptRow>(
      'SELECT * FROM notification_attempts WHERE task_id = $1 ORDER BY attempt_number',
      [taskId],
    );
    return result.rows.map(toAttempt);
  }
}
