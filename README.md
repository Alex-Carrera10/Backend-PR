# Reto GEEST — API de gestión de tareas

API REST en **Node.js 24 + TypeScript**, con **arquitectura hexagonal**, base de datos **PostgreSQL (Supabase)** y desplegada en **Render**.

## Cómo ejecutar el proyecto localmente

Requisitos: Node 24 (ver `.nvmrc`), una base PostgreSQL accesible (Supabase, local, etc.).

```bash
nvm use                    # usa Node 24.19.0 (si tenés nvm)
npm install
cp .env.example .env       # completar DATABASE_URL, NOTIFY_URL
npm run migrate            # aplica migrations/001_init.sql
npm run dev                # http://localhost:3000
npm test                   # corre la suite de Vitest + Supertest
npm run build && npm start # build de producción
```

`npm test` corre contra la base indicada en `DATABASE_URL` (usa `TRUNCATE` entre pruebas), por eso los archivos de test corren en serie (`vitest.config.ts: fileParallelism: false`) — comparten una base real, no mocks.

## Arquitectura

```
src/
  domain/           # entidades, errores, puertos (interfaces) — sin dependencias externas
  application/      # casos de uso, orquestan el dominio vía los puertos
  infrastructure/   # Postgres, Express, cliente HTTP de notificaciones — implementa los puertos
  main.ts           # composition root: cablea todo
```

Hexagonal para que el dominio (reglas de asignación/archivado) no dependa de Express ni de `pg`; los casos de uso se testean vía HTTP contra Postgres real, pero podrían testearse con repos en memoria sin tocar una línea del dominio.

## Decisiones técnicas y justificación

- **No serverless.** Los reintentos de notificación con backoff y el rate limiter necesitan estado/ejecución que sobreviva más allá de la respuesta HTTP. En Lambda/Functions eso exige colas o bloquear la respuesta; con un proceso Node persistente (Render) es un `setTimeout` normal.
- **Idempotencia (`Idempotency-Key`)**: se reserva la clave con un `INSERT` atómico en `idempotency_keys` (constraint `UNIQUE` en `key`). Si dos requests llegan en paralelo, solo uno gana el `INSERT`; el otro recibe `23505` y hace *polling* corto hasta que el ganador complete su respuesta, y la reutiliza. Así ambas respuestas quedan idénticas incluso bajo concurrencia real (probado en `tests/tasks.test.ts`).
- **Archivado sin duplicados**: `completeForUser` corre en una transacción que hace `SELECT ... FOR UPDATE` sobre la fila de la tarea, serializando cualquier completado concurrente sobre esa misma tarea. Solo la transacción que ve `total === completed` con `status = 'open'` ejecuta el `UPDATE ... WHERE status = 'open'`; la notificación se dispara únicamente si esa transacción fue la que archivó. Verificado con un test de 8 requests concurrentes sobre el mismo `taskId`.
- **Notificación con reintentos**: se dispara sin bloquear la respuesta HTTP del `complete` (fire-and-forget desde el caso de uso). Reintenta hasta 3 veces con espera creciente (0ms, 500ms, 1500ms) solo ante 5xx o falta de respuesta; cada intento se persiste en `notification_attempts`.
- **Supabase + Render**: Postgres real gestionado con tier gratuito, sin infraestructura propia que mantener; Render despliega directo desde GitHub sin Docker/CLI, con HTTPS automático.

## Supuestos ante ambigüedades

- IDs numéricos autoincrementales (no UUID), consistente con los ejemplos del enunciado (`userIds: [1,2,3]`, `taskId: 123`).
- Volver a completar una parte ya completada (mismo usuario, misma tarea) se trata como éxito idempotente, no como error — evita que un doble clic sin `Idempotency-Key` rompa el flujo.
- Una notificación se considera exitosa si el destino responde con cualquier status `< 500` (incluye 4xx, ya que un reintento no solucionaría un error del cliente).
- El hash de idempotencia se calcula sobre `JSON.stringify(body)` tal cual llega (sensible al orden de las claves); es una limitación conocida y razonable para el alcance del reto.
- `GET /users` considera "tareas pendientes" las tareas asignadas donde el usuario aún no completó su parte, sin importar el estado global de la tarea.

## Mejora — Rate limiting en memoria

**Problema que resuelve**: la API queda pública en Internet por 7 días sin autenticación; sin límite, un cliente (por error, bug de reintentos, o abuso) podría inundarla de requests y agotar el pool de conexiones del free tier de Supabase.

**Por qué era necesaria**: es el gap de robustez más directo dado que el propio reto exige exponer la API sin restricciones de red.

**Por qué esta sobre otras alternativas**: se evaluó agregar autenticación por API key, pero cambia el contrato de todos los endpoints y complica la evaluación automática. El rate limiter es transparente para requests normales, no modifica ningún endpoint requerido, y — a diferencia de una solución con Redis — el estado en memoria es válido precisamente porque decidimos **no** usar serverless (ver arriba). Configurable vía `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`; responde `429` con el mismo formato de error del resto de la API. Ver `src/infrastructure/http/rateLimiter.ts` y `tests/rateLimiter.test.ts`.

## Funcionalidades recortadas por falta de tiempo

- Sin autenticación/autorización (ver mejora elegida arriba como mitigación parcial).
- Sin paginación en `GET /tasks` y `GET /users` (aceptable para el volumen de datos de una prueba técnica).
- Sin logging estructurado ni métricas/observabilidad más allá de `console.error`.
- Sin documentación OpenAPI/Swagger (el enunciado y este README cubren el contrato).

## Despliegue

- **URL pública**: _(completar tras el deploy)_
- **Dónde**: Render (Web Service, free tier), conectado directo al repo de GitHub.
- **Por qué**: deploy sin Docker/CLI, HTTPS automático, `git push` dispara el redeploy. Contraparte: el free tier "duerme" tras inactividad — el primer request tras dormir puede tardar ~30-50s.
- **Base de datos**: Supabase (Postgres gestionado, free tier).
- **Cómo acceder**: cualquier cliente HTTP contra la URL pública + los endpoints documentados arriba (ver también `GET /health`).
