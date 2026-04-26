import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, URL } from 'url';

// 模拟 __dirname 在 ESM 中
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    minify: false, // 测试环境不压缩，方便调试和阅读输出的代码
    lib: {
      entry: resolve(__dirname, 'src/core/index.ts'),
      name: 'MySingleFile',
      // fileName: 'my-single-file',
      formats: ['es', 'umd'],
      fileName: (format) => {
        // 对于所有格式都使用 .js 扩展名
        return `my-single-file.${format}.js`;
      },
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
