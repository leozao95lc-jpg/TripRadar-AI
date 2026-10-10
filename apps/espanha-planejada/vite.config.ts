/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativo: o build funciona em qualquer subpasta de hospedagem estática.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
