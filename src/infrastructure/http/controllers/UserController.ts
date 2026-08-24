import type { CreateUserUseCase } from '../../../application/use-cases/CreateUser.js';
import type { ListUsersUseCase } from '../../../application/use-cases/ListUsers.js';
import type { GetUserTasksUseCase } from '../../../application/use-cases/GetUserTasks.js';
import { asyncHandler } from '../asyncHandler.js';
import { parseIdParam } from '../parseIdParam.js';
import { serializeUser, serializeUserWithPendingTasks, serializeTask } from '../serializers.js';

export class UserController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUserTasks: GetUserTasksUseCase,
  ) {}

  create = asyncHandler(async (req, res) => {
    const user = await this.createUser.execute(req.body);
    res.status(201).json(serializeUser(user));
  });

  list = asyncHandler(async (_req, res) => {
    const users = await this.listUsers.execute();
    res.status(200).json(users.map(serializeUserWithPendingTasks));
  });

  tasksForUser = asyncHandler(async (req, res) => {
    const userId = parseIdParam(req.params.idUser ?? '', 'idUser');
    const views = await this.getUserTasks.execute(userId);
    res.status(200).json(views.map((v) => ({ task: serializeTask(v.task), completed: v.completed })));
  });
}
