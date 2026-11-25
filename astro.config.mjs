import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.invalid', // TODO: Domain eintragen
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
