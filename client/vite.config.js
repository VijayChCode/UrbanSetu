import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  server:{
      proxy:{
        '/api':{
          target:"https://urbansetu.vercel.app/",
          secure:false,
        },
      },
  },
  plugins: [react()],
})
