import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig(({ mode }) => {
  // načítaj env z BP_2 (2 úrovne vyššie)
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');

  return {
    plugins: [
      react(),
      nodePolyfills({
        globals: {
          process: true,
          Buffer: true,
        },
        protocolImports: true,
      }),
    ],

    // sprístupní env premenné Vite-štýlom:
    // používaš ich ako import.meta.env.VITE_...
    envDir: path.resolve(__dirname, '../../'),
    envPrefix: 'VITE_',

    define: {
      // fix pre balíky, ktoré čítajú process.env
      'process.env': {},
    },
  };
});
