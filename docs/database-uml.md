# UML de la base de datos — Reto GEEST

```mermaid
erDiagram
    USERS ||--o{ TASK_ASSIGNMENTS : "tiene asignaciones"
    TASKS ||--o{ TASK_ASSIGNMENTS : "tiene asignaciones"
    TASKS ||--o{ NOTIFICATION_ATTEMPTS : "genera intentos"

    USERS {
        SERIAL id PK
        TEXT name
        TEXT last_name
        TEXT email UK "UNIQUE, NOT NULL"
        TIMESTAMPTZ created_at
    }

    TASKS {
        SERIAL id PK
        TEXT title "NOT NULL"
        TEXT description "NULLABLE"
        TEXT status "open | archived, DEFAULT open"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ archived_at "NULLABLE"
    }

    TASK_ASSIGNMENTS {
        INTEGER task_id PK, FK
        INTEGER user_id PK, FK
        TIMESTAMPTZ assigned_at
        TIMESTAMPTZ completed_at "NULLABLE — NULL = pendiente"
    }

    NOTIFICATION_ATTEMPTS {
        SERIAL id PK
        INTEGER task_id FK
        INTEGER attempt_number "1..3"
        INTEGER status_code "NULLABLE — NULL si no hubo respuesta"
        BOOLEAN succeeded
        TEXT error_message "NULLABLE"
        TIMESTAMPTZ attempted_at
    }

    IDEMPOTENCY_KEYS {
        TEXT key PK
        TEXT method
        TEXT path
        TEXT request_hash
        INTEGER status_code "NULLABLE mientras está en curso"
        JSONB response_body "NULLABLE mientras está en curso"
        TIMESTAMPTZ created_at
    }
```

## Notas de diseño

- **`task_assignments`** es la tabla puente (N:M) entre `users` y `tasks`. Su clave primaria compuesta `(task_id, user_id)` evita asignaciones duplicadas a nivel de base de datos (respaldando el `ON CONFLICT DO NOTHING` de la capa de aplicación).
- **`completed_at IS NULL`** representa "pendiente"; al completarse se setea con `now()`. La tarea se archiva cuando `count(*) = count(completed_at)` para ese `task_id`.
- **`notification_attempts`** no tiene relación con `idempotency_keys`: son mecanismos de confiabilidad independientes (uno para reintentos salientes, otro para requests entrantes duplicados).
- **`idempotency_keys`** no tiene FK hacia otras tablas a propósito: debe poder registrar la clave antes de saber a qué recurso terminará apuntando la operación.

El script SQL versionado y ejecutable está en [`migrations/001_init.sql`](../migrations/001_init.sql).
