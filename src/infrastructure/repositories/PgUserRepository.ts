import type { Pool } from 'pg';
import type { UserRepository, CreateUserData } from '../../domain/ports/UserRepository.js';
import type { User } from '../../domain/entities/User.js';

interface UserRow {
  id: number;
  name: string;
  last_name: string;
  email: string;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    lastName: row.last_name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateUserData): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (name, last_name, email) VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.lastName, data.email],
    );
    return toUser(result.rows[0]!);
  }

  async findById(id: number): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = ANY($1::int[])', [ids]);
    return result.rows.map(toUser);
  }

  async list(): Promise<User[]> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users ORDER BY id');
    return result.rows.map(toUser);
  }
}
