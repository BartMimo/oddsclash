import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind CSS v4 uses the Vite plugin (CSS-first config, see src/index.css)
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
