import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pageCssPlugin from './vite-plugin-page-css'
import packageJson from './package.json' with { type: 'json' }
import {fileURLToPath, URL} from "node:url";

// Chrome's Private Network Access (PNA) check blocks a public HTTPS page
// (Bondage Club) from fetching our local dev bundle at localhost unless the
// local server explicitly opts in via this response header. Without it you
// get "Permission was denied for this request to access the loopback
// address space" and the dynamic import() of main.js fails outright.
// This must run before Vite's own cors/static middlewares so the header is
// already set by the time the (possibly early-terminating, e.g. OPTIONS
// preflight) response is sent.
function privateNetworkAccessPlugin() {
  const addHeader = (_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
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
