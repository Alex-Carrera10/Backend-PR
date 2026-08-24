import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/infrastructure/db/pool.js';
import { resetDatabase } from './helpers/resetDatabase.js';
import { buildTestApp } from './helpers/testApp.js';

const { app, notifier } = buildTestApp();

beforeEach(async () => {
  await resetDatabase(pool);
  notifier.reset();
});

afterAll(async () => {
  await pool.end();
});

async function createUser(email: string) {
  const res = await request(app).post('/users').send({ name: 'Test', lastName: 'User', email });
  return res.body.id as number;
}

async function createTask(title = 'Tarea de prueba') {
  const res = await request(app).post('/tasks').send({ title });
  return res.body.id as number;
}

describe('POST /tasks', () => {
  it('crea una tarea en estado "open"', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Nueva tarea' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(typeof res.body.id).toBe('number');
  });

  it('rechaza si falta el título', async () => {
    const res = await request(app).post('/tasks').send({ description: 'sin título' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('permite crear una tarea sin descripción', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Sin descripción' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });
});

describe('POST /tasks/:idTask/assign', () => {
  it('asigna usuarios a una tarea', async () => {
    const userId = await createUser('a@example.com');
    const taskId = await createTask();

    const res = await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [userId] });

    expect(res.status).toBe(200);
    const detail = await request(app).get(`/tasks/${taskId}`);
    expect(detail.body.assignments).toEqual([{ userId, completed: false }]);
  });

  it('no duplica la relación si el usuario ya estaba asignado', async () => {
    const userId = await createUser('a@example.com');
    const taskId = await createTask();

    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [userId] });
    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [userId] });

    const detail = await request(app).get(`/tasks/${taskId}`);
    expect(detail.body.assignments).toHaveLength(1);
  });

  it('retorna error si la tarea no existe', async () => {
    const userId = await createUser('a@example.com');
    const res = await request(app).post('/tasks/999999/assign').send({ userIds: [userId] });
    expect(res.status).toBe(404);
  });

  it('retorna error si algún usuario no existe', async () => {
    const taskId = await createTask();
    const res = await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [999999] });
    expect(res.status).toBe(404);
  });
});

describe('POST /tasks/:idTask/complete', () => {
  it('marca la parte del usuario como completada sin archivar si faltan otros', async () => {
    const u1 = await createUser('a@example.com');
    const u2 = await createUser('b@example.com');
    const taskId = await createTask();
    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [u1, u2] });

    const res = await request(app).post(`/tasks/${taskId}/complete`).send({ userId: u1 });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('open');
    expect(notifier.calls).toHaveLength(0);
  });

  it('archiva la tarea y notifica cuando todos completan su parte', async () => {
    const u1 = await createUser('a@example.com');
    const u2 = await createUser('b@example.com');
    const taskId = await createTask('Última parte');
    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [u1, u2] });

    await request(app).post(`/tasks/${taskId}/complete`).send({ userId: u1 });
    const res = await request(app).post(`/tasks/${taskId}/complete`).send({ userId: u2 });

    expect(res.body.task.status).toBe('archived');
    expect(res.body.task.archivedAt).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0]).toMatchObject({ taskId, title: 'Última parte' });
  });

  it('reintenta hasta 3 veces si la notificación falla con 5xx y registra cada intento', async () => {
    notifier.setDefaultResult({ ok: false, statusCode: 500, errorMessage: 'HTTP 500' });
    const u1 = await createUser('a@example.com');
    const taskId = await createTask();
    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [u1] });

    await request(app).post(`/tasks/${taskId}/complete`).send({ userId: u1 });

    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(notifier.calls).toHaveLength(3);

    const attempts = await request(app).get(`/tasks/${taskId}/notifications`);
    expect(attempts.body).toHaveLength(3);
    expect(attempts.body.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([1, 2, 3]);
    expect(attempts.body.every((a: { succeeded: boolean }) => a.succeeded === false)).toBe(true);
  });

  it('retorna error si el usuario no está asignado a la tarea', async () => {
    const userId = await createUser('a@example.com');
    const taskId = await createTask();
    const res = await request(app).post(`/tasks/${taskId}/complete`).send({ userId });
    expect(res.status).toBe(404);
  });

  it('retorna error si la tarea o el usuario no existen', async () => {
    const res = await request(app).post('/tasks/999999/complete').send({ userId: 1 });
    expect(res.status).toBe(404);
  });

  it('archiva exactamente una vez y notifica exactamente una vez ante completados concurrentes', async () => {
    const u1 = await createUser('a@example.com');
    const u2 = await createUser('b@example.com');
    const taskId = await createTask('Concurrente');
    await request(app).post(`/tasks/${taskId}/assign`).send({ userIds: [u1, u2] });
    await request(app).post(`/tasks/${taskId}/complete`).send({ userId: u1 });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => request(app).post(`/tasks/${taskId}/complete`).send({ userId: u2 })),
    );

    for (const res of results) {
      expect(res.body.task.status).toBe('archived');
    }
    const archivedTimestamps = new Set(results.map((r) => r.body.task.archivedAt));
    expect(archivedTimestamps.size).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifier.calls).toHaveLength(1);
  });
});

describe('GET /tasks', () => {
  it('filtra por status', async () => {
    const openTaskId = await createTask('Abierta');
    const u1 = await createUser('a@example.com');
    const archivedTaskId = await createTask('Archivada');
    await request(app).post(`/tasks/${archivedTaskId}/assign`).send({ userIds: [u1] });
    await request(app).post(`/tasks/${archivedTaskId}/complete`).send({ userId: u1 });

    const openRes = await request(app).get('/tasks?status=open');
    expect(openRes.body.map((t: { id: number }) => t.id)).toEqual([openTaskId]);

    const archivedRes = await request(app).get('/tasks?status=archived');
    expect(archivedRes.body.map((t: { id: number }) => t.id)).toEqual([archivedTaskId]);
  });

  it('rechaza un status inválido', async () => {
    const res = await request(app).get('/tasks?status=cualquiera');
    expect(res.status).toBe(400);
  });
});

describe('Idempotency-Key', () => {
  it('devuelve la misma respuesta ante dos requests idénticas en paralelo', async () => {
    const key = `key-${Date.now()}`;
    const body = { title: 'Tarea idempotente' };

    const [r1, r2] = await Promise.all([
      request(app).post('/tasks').set('Idempotency-Key', key).send(body),
      request(app).post('/tasks').set('Idempotency-Key', key).send(body),
    ]);

    expect(r1.body).toEqual(r2.body);

    const all = await request(app).get('/tasks');
    expect(all.body).toHaveLength(1);
  });

  it('rechaza la misma key con un body diferente', async () => {
    const key = `key-${Date.now()}`;
    await request(app).post('/tasks').set('Idempotency-Key', key).send({ title: 'A' });
    const res = await request(app).post('/tasks').set('Idempotency-Key', key).send({ title: 'B' });

    expect(res.status).toBe(409);
  });
});
