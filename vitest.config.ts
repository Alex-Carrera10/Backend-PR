import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests golpean una base de datos real compartida (Supabase) y hacen
    // TRUNCATE entre casos, así que los archivos no pueden correr en paralelo.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
