import type { UserRepository } from '../../domain/ports/UserRepository.js';
import type { User } from '../../domain/entities/User.js';
import { ValidationError, ConflictError } from '../../domain/errors/AppError.js';
import { isValidEmail } from '../../domain/services/isValidEmail.js';

export interface CreateUserInput {
  name?: unknown;
  lastName?: unknown;
  email?: unknown;
}

export class CreateUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: CreateUserInput): Promise<User> {
    const { name, lastName, email } = input;

    if (typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('El campo "name" es obligatorio.');
    }
    if (typeof lastName !== 'string' || !lastName.trim()) {
      throw new ValidationError('El campo "lastName" es obligatorio.');
    }
    if (typeof email !== 'string' || !email.trim()) {
      throw new ValidationError('El campo "email" es obligatorio.');
    }
    if (!isValidEmail(email)) {
      throw new ValidationError('El correo electrónico no es válido.');
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Ya existe un usuario registrado con ese correo electrónico.');
    }

    return this.users.create({ name: name.trim(), lastName: lastName.trim(), email: email.trim() });
  }
}
