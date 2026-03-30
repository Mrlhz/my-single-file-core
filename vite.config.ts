import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    minify: false, // 测试环境不压缩，方便调试和阅读输出的代码
    lib: {
      entry: resolve(__dirname, 'src/core/index.ts'),
      name: 'MySingleFile',
      fileName: 'my-single-file',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // 确保无外部依赖（纯浏览器运行）
      external: [],
      output: {
        globals: {}
      }
    }
  },
  esbuild: {
    // 支持 top-level await in browsers
    target: 'es2022'
  }
});
