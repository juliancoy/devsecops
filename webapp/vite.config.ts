import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({

  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    hmr: false
    /*{
      host: 'app.codecollective.us', // Use your domain for HMR in production
      protocol: 'wss', // Secure WebSocket (works with port 443)
    },*/
  },
  build: {
      chunkSizeWarningLimit: 1000, // Increase the limit to 1 MB
  },
});