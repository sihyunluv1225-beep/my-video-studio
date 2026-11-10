import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' 로 두면 GitHub Pages 같은 하위 주소에서도 그대로 동작합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2019', chunkSizeWarningLimit: 1500 },
});
