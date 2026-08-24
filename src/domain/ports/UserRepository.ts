import type { User } from '../entities/User.js';

export interface CreateUserData {
  name: string;
  lastName: string;
  email: string;
}

export interface UserRepository {
  create(data: CreateUserData): Promise<User>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIds(ids: number[]): Promise<User[]>;
  list(): Promise<User[]>;
}
