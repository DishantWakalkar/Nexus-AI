import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — rarely changes, long-lived cache
          react: ['react', 'react-dom', 'react-router-dom'],
          // Markdown pipeline — large but only needed in chat view
          markdown: ['react-markdown', 'remark-gfm', 'rehype-raw'],
        },
      },
    },
  },
});
