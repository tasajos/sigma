import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// El servidor de desarrollo se sirve por HTTPS (certificado autofirmado) y
// escucha en todas las interfaces de red, no solo en localhost. Esto es
// necesario para que un celular en la misma red pueda abrir la app por la
// IP del equipo (http://localhost:5173 solo es alcanzable desde este mismo
// equipo) y para que el navegador del celular autorice la geolocalización:
// getCurrentPosition/watchPosition solo funcionan en un contexto seguro
// (HTTPS o localhost), nunca por IP de red en HTTP plano.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api':       { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true }
    }
  }
});
