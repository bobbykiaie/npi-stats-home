import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
   server: {
    proxy: {
      // Any request starting with /api will be forwarded
      '/api': {
        target: 'http://localhost:5000', // Your backend server
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false,      // Can be false for http
      }
    }
  },
  css: {
    postcss: './postcss.config.js',
  },
  base: '/', // Update base path to match GitHub Pages subdirectory
});