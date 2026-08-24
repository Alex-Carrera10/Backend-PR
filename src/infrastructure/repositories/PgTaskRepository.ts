import type { Pool, PoolClient } from 'pg';
import type {
  TaskRepository,
  CreateTaskData,
  TaskDetail,
  TaskAssignmentView,
  UserTaskView,
  CompleteResult,
} from '../../domain/ports/TaskRepository.js';
import type { Task, TaskStatus } from '../../domain/entities/Task.js';
import { NotFoundError } from '../../domain/errors/AppError.js';

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: Date;
  archived_at: Date | null;
}

interface AssignmentRow {
  task_id: number;
  user_id: number;
  completed_at: Date | null;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export class PgTaskRepository implements TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateTaskData): Promise<Task> {
    const result = await this.pool.query<TaskRow>(
      `INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *`,
      [data.title, data.description],
    );
    return toTask(result.rows[0]!);
  }

  async findById(id: number): Promise<Task | null> {
    const result = await this.pool.query<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] ? toTask(result.rows[0]) : null;
  }

  async list(status?: TaskStatus): Promise<TaskDetail[]> {
    const tasksResult = status
      ? await this.pool.query<TaskRow>('SELECT * FROM tasks WHERE status = $1 ORDER BY id', [status])
      : await this.pool.query<TaskRow>('SELECT * FROM tasks ORDER BY id');

    const taskIds = tasksResult.rows.map((r) => r.id);
    const assignmentsByTask = await this.getAssignmentsForTasks(taskIds);

    return tasksResult.rows.map((row) => ({
      ...toTask(row),
      assignments: assignmentsByTask.get(row.id) ?? [],
    }));
  }

  async getDetail(id: number): Promise<TaskDetail | null> {
    const task = await this.findById(id);
    if (!task) return null;
    const assignmentsByTask = await this.getAssignmentsForTasks([id]);
    return { ...task, assignments: assignmentsByTask.get(id) ?? [] };
  }

  private async getAssignmentsForTasks(taskIds: number[]): Promise<Map<number, TaskAssignmentView[]>> {
    const map = new Map<number, TaskAssignmentView[]>();
    if (taskIds.length === 0) return map;

    const result = await this.pool.query<AssignmentRow>(
      'SELECT task_id, user_id, completed_at FROM task_assignments WHERE task_id = ANY($1::int[]) ORDER BY user_id',
      [taskIds],
    );

    for (const row of result.rows) {
      const list = map.get(row.task_id) ?? [];
      list.push({ userId: row.user_id, completed: row.completed_at !== null });
      map.set(row.task_id, list);
    }
    return map;
  }

  async assignUsers(taskId: number, userIds: number[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const taskResult = await client.query('SELECT id FROM tasks WHERE id = $1', [taskId]);
      if (taskResult.rows.length === 0) {
        throw new NotFoundError(`No existe una tarea con id ${taskId}.`);
      }

      const uniqueUserIds = [...new Set(userIds)];
      const usersResult = await client.query<{ id: number }>(
        'SELECT id FROM users WHERE id = ANY($1::int[])',
        [uniqueUserIds],
      );
      const foundIds = new Set(usersResult.rows.map((r) => r.id));
      const missing = uniqueUserIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new NotFoundError(`No existen usuarios con id: ${missing.join(', ')}.`);
      }

      await client.query(
        `INSERT INTO task_assignments (task_id, user_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT (task_id, user_id) DO NOTHING`,
        [taskId, uniqueUserIds],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async completeForUser(taskId: number, userId: number): Promise<CompleteResult> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Bloquea la fila de la tarea: serializa cualquier completado concurrente
      // sobre la misma tarea, garantizando archivado y notificación exactamente una vez.
      const taskResult = await client.query<TaskRow>('SELECT * FROM tasks WHERE id = $1 FOR UPDATE', [taskId]);
      const taskRow = taskResult.rows[0];
      if (!taskRow) {
        throw new NotFoundError(`No existe una tarea con id ${taskId}.`);
      }

      const userResult = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new NotFoundError(`No existe un usuario con id ${userId}.`);
      }

      const assignmentResult = await client.query<AssignmentRow>(
        'SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2',
        [taskId, userId],
      );
      const assignment = assignmentResult.rows[0];
      if (!assignment) {
        throw new NotFoundError('El usuario no está asignado a esta tarea.');
      }

      if (!assignment.completed_at) {
        await client.query(
          'UPDATE task_assignments SET completed_at = now() WHERE task_id = $1 AND user_id = $2',
          [taskId, userId],
        );
      }

      const totals = await client.query<{ total: number; completed: number }>(
        `SELECT count(*)::int AS total, count(completed_at)::int AS completed
         FROM task_assignments WHERE task_id = $1`,
        [taskId],
      );
      const { total, completed } = totals.rows[0]!;

      let finalTaskRow = taskRow;
      let justArchived = false;

      if (total > 0 && total === completed && taskRow.status === 'open') {
        const archiveResult = await client.query<TaskRow>(
          `UPDATE tasks SET status = 'archived', archived_at = now() WHERE id = $1 AND status = 'open' RETURNING *`,
          [taskId],
        );
        if (archiveResult.rows[0]) {
          finalTaskRow = archiveResult.rows[0];
          justArchived = true;
        }
      }

      await client.query('COMMIT');
      return { task: toTask(finalTaskRow), justArchived };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTasksForUser(userId: number): Promise<UserTaskView[]> {
    const result = await this.pool.query<TaskRow & { completed_at: Date | null }>(
      `SELECT t.*, ta.completed_at
       FROM task_assignments ta
       JOIN tasks t ON t.id = ta.task_id
       WHERE ta.user_id = $1
       ORDER BY t.id`,
      [userId],
    );

    return result.rows.map((row) => ({
      task: toTask(row),
      completed: row.completed_at !== null,
    }));
  }
}
