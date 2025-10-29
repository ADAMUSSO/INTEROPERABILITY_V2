import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Cesta o dve úrovne vyššie (z web/my-react-app → BP_2)
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');

  return {
    plugins: [react()],
    define: {
      // Definujeme tie premenné, ktoré chceš používať v kóde
      'import.meta.env.VITE_ETH_MAINNET_RPC': JSON.stringify(env.VITE_ETH_MAINNET_RPC),
      'import.meta.env.VITE_SEPOLIA_RPC': JSON.stringify(env.SEPOLIA_RPC),
    },
  };
});
