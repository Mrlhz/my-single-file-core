// scripts/copy-examples.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 模拟 __dirname (因为 package.json 中设置了 "type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义源文件和目标路径
// 注意：根据你的 vite 配置，文件名应该是 my-single-file.umd.js
const sourceFile = path.resolve(__dirname, '../dist/my-single-file.umd.js');
const targetDir = path.resolve(__dirname, '../examples');
const targetFile = path.join(targetDir, 'my-single-file.umd.js');

try {
  // 1. 检查源文件是否存在（防止构建失败导致报错）
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ 错误: 源文件不存在 - ${sourceFile}`);
    process.exit(1);
  }

  // 2. 确保目标目录存在，如果不存在则创建
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 3. 执行复制（覆盖模式）
  fs.copyFileSync(sourceFile, targetFile);
  
  console.log('✅ 成功: 已将 my-single-file.umd.js 复制到 examples 目录');
} catch (err) {
  console.error('❌ 复制文件时发生错误:', err);
  process.exit(1);
}
