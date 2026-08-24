import type { Task } from '../../domain/entities/Task.js';
import type { TaskDetail } from '../../domain/ports/TaskRepository.js';
import type { User } from '../../domain/entities/User.js';
import type { UserWithPendingTasks } from '../../application/use-cases/ListUsers.js';
import type { NotificationAttempt } from '../../domain/entities/NotificationAttempt.js';

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeUserWithPendingTasks(user: UserWithPendingTasks) {
  return {
    ...serializeUser(user),
    pendingTasks: user.pendingTasks.map(serializeTask),
  };
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
  };
}

export function serializeTaskDetail(task: TaskDetail) {
  return {
    ...serializeTask(task),
    assignments: task.assignments,
  };
}

export function serializeNotificationAttempt(attempt: NotificationAttempt) {
  return {
    attemptNumber: attempt.attemptNumber,
    statusCode: attempt.statusCode,
    succeeded: attempt.succeeded,
    errorMessage: attempt.errorMessage,
    attemptedAt: attempt.attemptedAt.toISOString(),
  };
}
