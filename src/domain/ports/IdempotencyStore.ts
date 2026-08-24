export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}

export type BeginResult =
  | { status: 'new' }
  | { status: 'existing'; record: IdempotencyRecord }
  | { status: 'in_progress' };

export interface IdempotencyStore {
  /**
   * Intenta reservar la clave. Si ya existe una respuesta completa, la retorna.
   * Si otra request con la misma clave está en curso, retorna 'in_progress'
   * para que el caller espere (waitForCompletion).
   */
  begin(key: string, method: string, path: string, requestHash: string): Promise<BeginResult>;
  complete(key: string, statusCode: number, responseBody: unknown): Promise<void>;
  waitForCompletion(key: string, timeoutMs?: number): Promise<IdempotencyRecord>;
}
