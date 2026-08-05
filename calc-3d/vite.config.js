// =============================================================================
// Конфигурация Vite
// Задача: npm run build должен дать ЕДИНСТВЕННЫЙ самодостаточный dist/index.html
// =============================================================================
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // Относительный base, чтобы единый файл открывался с любого статик-хостинга
  base: './',
  plugins: [viteSingleFile()],
  build: {
    // Не понижаем современный синтаксис: код three.js остаётся как есть
    target: 'esnext'
  }
});