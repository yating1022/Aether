import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Local development port is 5199 on purpose: 5173 belongs to another project on
 * this machine, and stepping on it means one of the two dev servers silently
 * takes over the other's URL.
 *
 * This port is a *dev-server* setting only. Deployment (Vercel and friends)
 * never reads it — the built `dist/` is served statically on the platform's own
 * port (443). `strictPort` keeps the URL predictable instead of quietly
 * incrementing to 5200.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
    strictPort: true,
  },
  preview: {
    port: 5199,
    strictPort: true,
  },
});
