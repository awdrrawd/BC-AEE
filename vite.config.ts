import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pageCssPlugin from './vite-plugin-page-css'
import packageJson from './package.json' with { type: 'json' }
import {fileURLToPath, URL} from "node:url";

function privateNetworkAccessPlugin() {
  const addHeader = (_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'ETag, Last-Modified');
    next();
  };
  return {
    name: 'private-network-access-header',
    configureServer(server: { middlewares: { use: (fn: typeof addHeader) => void } }) {
      server.middlewares.use(addHeader);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof addHeader) => void } }) {
      server.middlewares.use(addHeader);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [privateNetworkAccessPlugin(), pageCssPlugin(), tailwindcss(), react()],
  base: './',
  define: {
    __AEE_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    cors: true,
  },
  preview: {
    cors: true,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      },
    },
  },
})
