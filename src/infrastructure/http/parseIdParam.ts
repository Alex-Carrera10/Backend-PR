import { ValidationError } from '../../domain/errors/AppError.js';

export function parseIdParam(raw: string, name = 'id'): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`El parámetro "${name}" debe ser un entero positivo.`);
  }
  return id;
}
