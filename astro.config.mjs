import { defineConfig } from 'astro/config';

// https://astro.build/config
// Die Adresse kommt beim Deployment aus der Umgebung (GitHub Pages setzt SITE),
// lokal bleibt der Platzhalter. Eigene Domain später hier eintragen.
export default defineConfig({
  site: process.env.SITE ?? 'https://example.invalid',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
