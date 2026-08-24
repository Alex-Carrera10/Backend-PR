import type { Pool } from 'pg';

export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query(
    'TRUNCATE TABLE notification_attempts, task_assignments, idempotency_keys, tasks, users RESTART IDENTITY CASCADE',
  );
}
