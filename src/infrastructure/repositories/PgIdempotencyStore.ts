import type { Pool } from 'pg';
import type { IdempotencyStore, BeginResult, IdempotencyRecord } from '../../domain/ports/IdempotencyStore.js';
import { ConflictError } from '../../domain/errors/AppError.js';

interface KeyRow {
  key: string;
  request_hash: string;
  status_code: number | null;
  response_body: unknown;
}

const UNIQUE_VIOLATION = '23505';
const POLL_INTERVAL_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly pool: Pool) {}

  async begin(key: string, method: string, path: string, requestHash: string): Promise<BeginResult> {
    try {
      await this.pool.query(
        `INSERT INTO idempotency_keys (key, method, path, request_hash) VALUES ($1, $2, $3, $4)`,
        [key, method, path, requestHash],
      );
      return { status: 'new' };
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr.code !== UNIQUE_VIOLATION) throw err;

      const existing = await this.pool.query<KeyRow>('SELECT * FROM idempotency_keys WHERE key = $1', [key]);
      const row = existing.rows[0];
      if (!row) {
        // Condición de carrera muy estrecha: la fila que chocó ya no está. Se trata como nueva.
        return this.begin(key, method, path, requestHash);
      }

      if (row.request_hash !== requestHash) {
        throw new ConflictError(
          'La Idempotency-Key ya fue usada con un cuerpo de solicitud diferente.',
        );
      }

      if (row.status_code === null) {
        return { status: 'in_progress' };
      }

      return {
        status: 'existing',
        record: {
          key: row.key,
          requestHash: row.request_hash,
          statusCode: row.status_code,
          responseBody: row.response_body,
        },
      };
    }
  }

  async complete(key: string, statusCode: number, responseBody: unknown): Promise<void> {
    await this.pool.query(
      'UPDATE idempotency_keys SET status_code = $2, response_body = $3 WHERE key = $1',
      [key, statusCode, responseBody],
    );
  }

  async waitForCompletion(key: string, timeoutMs = 8000): Promise<IdempotencyRecord> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await this.pool.query<KeyRow>('SELECT * FROM idempotency_keys WHERE key = $1', [key]);
      const row = result.rows[0];
      if (row && row.status_code !== null) {
        return {
          key: row.key,
          requestHash: row.request_hash,
          statusCode: row.status_code,
          responseBody: row.response_body,
        };
      }
      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Timeout esperando la respuesta original para Idempotency-Key ${key}.`);
  }
}
