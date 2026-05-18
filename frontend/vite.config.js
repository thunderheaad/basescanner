import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Optimisation mobile : chunks plus petits
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  // Proxy local pour le développement (évite les erreurs CORS en dev)
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_WORKER_URL || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
