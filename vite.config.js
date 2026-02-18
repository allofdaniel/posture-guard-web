import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      'node_modules/**',
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  build: {
    // 프로덕션 빌드 최적화
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        // 청크 이름 해시화
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@mediapipe')) {
              return 'mediapipe';
            }
            if (id.includes('react')) {
              return 'vendor';
            }
          }
        }
      }
    },
    // 소스맵 비활성화 (리버스엔지니어링 방지)
    sourcemap: false,
    // 청크 크기 경고 조정
    chunkSizeWarningLimit: 1000
  },
  // 개발 서버 최적화
  server: {
    hmr: {
      overlay: false
    }
  },
  // esbuild 최적화
  esbuild: {
    drop: ['console', 'debugger']
  }
})
