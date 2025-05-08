import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode (development, production)
  // and the current working directory.
  // This makes VITE_BASE_URL available from .env files or environment variables.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: env.VITE_BASE_URL || '/', // Use VITE_BASE_URL if set, otherwise default to '/'
    server: {
      port: 3000,
    }
  };
});
