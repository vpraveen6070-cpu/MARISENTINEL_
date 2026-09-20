import { defineConfig } from 'vite';
import { resolve } from 'path';

const dir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : process.cwd();

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(dir, 'index.html'),
        login: resolve(dir, 'login.html'),
        command: resolve(dir, 'command.html'),
        field: resolve(dir, 'field.html'),
        admin: resolve(dir, 'admin.html')
      }
    }
  }
});
