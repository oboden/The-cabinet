import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` → normal Vercel build.
// `SINGLEFILE=1 npm run build` → one self-contained HTML file (used for the preview link).
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.SINGLEFILE ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: process.env.SINGLEFILE ? { outDir: 'dist-single' } : {},
})
