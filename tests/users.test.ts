import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/infrastructure/db/pool.js';
import { resetDatabase } from './helpers/resetDatabase.js';
import { buildTestApp } from './helpers/testApp.js';

const { app } = buildTestApp();

beforeEach(async () => {
  await resetDatabase(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /users', () => {
  it('crea un usuario y retorna su id', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Ana', lastName: 'Pérez', email: 'ana@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Ana', lastName: 'Pérez', email: 'ana@example.com' });
    expect(typeof res.body.id).toBe('number');
  });

  it('rechaza si falta información obligatoria', async () => {
    const res = await request(app).post('/users').send({ name: 'Ana' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un correo electrónico inválido', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Ana', lastName: 'Pérez', email: 'no-es-un-correo' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /users', () => {
  it('lista usuarios con sus tareas pendientes', async () => {
    const user = await request(app)
      .post('/users')
      .send({ name: 'Ana', lastName: 'Pérez', email: 'ana@example.com' });
    const task = await request(app).post('/tasks').send({ title: 'Tarea 1', description: 'Detalle' });
    await request(app).post(`/tasks/${task.body.id}/assign`).send({ userIds: [user.body.id] });

    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].pendingTasks).toHaveLength(1);
    expect(res.body[0].pendingTasks[0].id).toBe(task.body.id);
  });
});

describe('GET /users/:idUser/tasks', () => {
  it('indica si el usuario completó su parte en cada tarea', async () => {
    const user = await request(app)
      .post('/users')
      .send({ name: 'Ana', lastName: 'Pérez', email: 'ana@example.com' });
    const task = await request(app).post('/tasks').send({ title: 'Tarea 1', description: 'Detalle' });
    await request(app).post(`/tasks/${task.body.id}/assign`).send({ userIds: [user.body.id] });
    await request(app).post(`/tasks/${task.body.id}/complete`).send({ userId: user.body.id });

    const res = await request(app).get(`/users/${user.body.id}/tasks`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].completed).toBe(true);
  });

  it('retorna 404 si el usuario no existe', async () => {
    const res = await request(app).get('/users/999999/tasks');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
