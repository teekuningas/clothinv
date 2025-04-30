import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Specify the development server port
    // Optional: Proxy API requests to Datasette backend if needed later
    // proxy: {
    //   '/api': { // Example: proxy requests starting with /api
    //     target: 'http://127.0.0.1:8001', // Datasette server address
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/api/, '') // Remove /api prefix
    //   }
    // }
  }
})
