import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // three n'est importé que par l'écran vocal, lui-même chargé à la demande :
  // Vite ne le découvre donc pas au démarrage et le pré-bundle à chaud, ce qui
  // renvoie un 504 « Outdated Optimize Dep » sur la première ouverture du mode
  // vocal. Le déclarer ici le fait optimiser dès le lancement du serveur.
  optimizeDeps: {
    include: ['three'],
  },
  server: {
    host: '0.0.0.0',   // <-- permet l’accès depuis le réseau
    port: 5173,
    strictPort: true,
  },
})
