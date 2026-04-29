import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      ignored: ['**/.pnpm-store/**', '**/datatrue/**', '**/api/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  build: {
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
        }
      }
    }
  }
})
