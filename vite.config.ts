import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH задаёт сборка для GitHub Pages (сайт живёт в подпапке /<имя-репозитория>/); локально — корень.
export default defineConfig({ base: process.env.BASE_PATH ?? '/', plugins: [react()] });
