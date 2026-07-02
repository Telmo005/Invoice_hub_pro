import { defineConfig } from 'vitest/config';
import path from 'path';

// Sem isto, "@/..." (usado em quase todo o código-fonte, mirando o mapping
// de tsconfig.json) não resolve em testes -- toda a suite falhava a carregar
// antes desta config existir (não havia nenhum ficheiro vitest.config.*).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
