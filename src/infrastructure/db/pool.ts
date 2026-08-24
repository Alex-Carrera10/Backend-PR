import pg from 'pg';
import 'dotenv/config';

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL.');
}

const isLocalDb = rawConnectionString.includes('localhost') || rawConnectionString.includes('127.0.0.1');

// Se retira cualquier `sslmode` de la URL: pg-connection-string trata
// require/prefer/verify-ca como verify-full, lo que falla contra el
// certificado del pooler de Supabase. El objeto `ssl` explícito de abajo
// es la única fuente de verdad para la configuración TLS.
const url = new URL(rawConnectionString);
url.searchParams.delete('sslmode');
const connectionString = url.toString();

export const pool = new pg.Pool({
  connectionString,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
