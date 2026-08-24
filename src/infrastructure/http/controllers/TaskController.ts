import type { CreateTaskUseCase } from '../../../application/use-cases/CreateTask.js';
import type { AssignUsersToTaskUseCase } from '../../../application/use-cases/AssignUsersToTask.js';
import type { CompleteTaskForUserUseCase } from '../../../application/use-cases/CompleteTaskForUser.js';
import type { ListTasksUseCase } from '../../../application/use-cases/ListTasks.js';
import type { GetTaskUseCase } from '../../../application/use-cases/GetTask.js';
import type { ListNotificationAttemptsUseCase } from '../../../application/use-cases/ListNotificationAttempts.js';
import { asyncHandler } from '../asyncHandler.js';
import { parseIdParam } from '../parseIdParam.js';
import { serializeTask, serializeTaskDetail, serializeNotificationAttempt } from '../serializers.js';

export class TaskController {
  constructor(
    private readonly createTask: CreateTaskUseCase,
    private readonly assignUsersToTask: AssignUsersToTaskUseCase,
    private readonly completeTaskForUser: CompleteTaskForUserUseCase,
    private readonly listTasks: ListTasksUseCase,
    private readonly getTask: GetTaskUseCase,
    private readonly listNotificationAttempts: ListNotificationAttemptsUseCase,
  ) {}

  create = asyncHandler(async (req, res) => {
    const task = await this.createTask.execute(req.body);
    res.status(201).json(serializeTask(task));
  });

  assign = asyncHandler(async (req, res) => {
    const taskId = parseIdParam(req.params.idTask ?? '', 'idTask');
    await this.assignUsersToTask.execute(taskId, req.body);
    res.status(200).json({ message: 'Usuarios asignados correctamente.' });
  });

  complete = asyncHandler(async (req, res) => {
    const taskId = parseIdParam(req.params.idTask ?? '', 'idTask');
    const task = await this.completeTaskForUser.execute(taskId, req.body);
    res.status(200).json({ message: 'Parte del usuario marcada como completada.', task: serializeTask(task) });
  });

  list = asyncHandler(async (req, res) => {
    const tasks = await this.listTasks.execute(req.query.status);
    res.status(200).json(tasks.map(serializeTaskDetail));
  });

  getOne = asyncHandler(async (req, res) => {
    const taskId = parseIdParam(req.params.idTask ?? '', 'idTask');
    const task = await this.getTask.execute(taskId);
    res.status(200).json(serializeTaskDetail(task));
  });

  notifications = asyncHandler(async (req, res) => {
    const taskId = parseIdParam(req.params.idTask ?? '', 'idTask');
    const attempts = await this.listNotificationAttempts.execute(taskId);
    res.status(200).json(attempts.map(serializeNotificationAttempt));
  });
}
