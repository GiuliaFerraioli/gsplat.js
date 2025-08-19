import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts()],
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'gsplat',
      fileName: (format) => `index.${format}.js`,
      formats: ['es']
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    sourcemap: true,
    target: 'esnext',
    copyPublicDir: false
  },
  server: {
  host: true,         
  port: 5173,
  strictPort: true,
  cors: true,
  origin: 'https://b1c61a136878.ngrok-free.app',
  hmr: {
    protocol: 'ws',
    host: 'b1c61a136878.ngrok-free.app',
  },
  allowedHosts: ['b1c61a136878.ngrok-free.app']
  },
  worker: {
    format: 'es',
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  publicDir: false
});
