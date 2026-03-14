import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  output: 'hybrid',
  adapter: undefined, // Using Vercel adapter in production
});
