import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pageCssPlugin from './vite-plugin-page-css'
import packageJson from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [pageCssPlugin(), tailwindcss(), react()],
  base: './',
  define: {
    __AEE_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    cors: true,
  },
  preview: {
    cors: true,
  },
  build: {
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
