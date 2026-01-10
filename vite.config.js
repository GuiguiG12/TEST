import { defineConfig } from 'vite'
import { resolve } from 'path'

/**
 * If you deploy to GitHub Pages under https://<user>.github.io/<repo>/,
 * set base to '/<repo>/'.
 *
 * Example: repo name = TEST  -> base: '/TEST/'
 */
export default defineConfig({
  base: '/TEST/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        strategies: resolve(__dirname, 'strategies.html'),
        docs: resolve(__dirname, 'docs.html'),
        access: resolve(__dirname, 'access.html')
      }
    }
  }
})
