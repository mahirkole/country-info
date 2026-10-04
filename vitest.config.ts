import { defineConfig } from 'vitest/config';

// DB tests share one database and recreate its schema: run files one at a time.
export default defineConfig({ test: { fileParallelism: false } });
