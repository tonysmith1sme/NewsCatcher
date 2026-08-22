import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat all tags with md- or starting with md as custom elements for @material/web
          isCustomElement: (tag) => tag.startsWith('md-')
        }
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4000
  }
})
