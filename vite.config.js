import { defineConfig } from 'vite';

// base './' : l'app fonctionne quelle que soit l'adresse d'hébergement
// (GitHub Pages dans un sous-dossier, Cloudflare Pages, nom de domaine…).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
  test: { environment: 'node' },
});
