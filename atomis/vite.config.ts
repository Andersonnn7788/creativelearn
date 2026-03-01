import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;
    const elevenLabsKey = env.ELEVENLABS_API_KEY || env.VITE_ELEVENLABS_API_KEY;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        '__OPENAI_API_KEY__': JSON.stringify(openaiKey),
        '__ELEVENLABS_API_KEY__': JSON.stringify(elevenLabsKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
