# My Single File

> 基于 Vite + TypeScript + qianwen 重构的网页单文件归档库

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

My Single File 是一个现代化的网页打包工具库，旨在将复杂的网页（包含 HTML, CSS, JS, 图片, 字体等）递归地打包成一个独立的 HTML 文件。本项目灵感源自 [gildas-lormeau/single-file-core](https://github.com/gildas-lormeau/single-file-core)，采用 **Vite 库模式** 构建，并使用 **TypeScript** 提供严格的类型安全。

学习现代前端工程化、模块化设计以及复杂 DOM 操作。

---

## 📚 特性

- **单文件归档**：将网页及其所有外部资源（CSS, 图片, 字体, JS）合并为一个自包含的 HTML 文件。
- **现代架构**：基于 Vite 构建，支持 ES 模块和 UMD 格式，开箱即用。
- **类型安全**：完整的 TypeScript 支持，提供清晰的 API 类型定义。
- **模块化设计**：采用策略模式处理不同资源类型，逻辑清晰，易于扩展。
- **浏览器原生运行**：不依赖 Node.js 环境，纯浏览器端执行。

## 📦 目录结构


```bash
my-single-file/
├── src/
│   ├── core/                       # 核心逻辑
│   │   ├── index.ts                # 核心导出
│   │   ├── page-archiver.ts        # 主打包类 (PageArchiver)
│   │   └── resource-graph.ts       # 资源依赖图管理
│   │
│   ├── processors/                 # 资源处理器 (策略模式)
│   │   ├── index.ts
│   │   ├── image-processor.ts      # 图片处理
│   │   ├── style-processor.ts      # CSS 处理
│   │   ├── script-processor.ts     # JS 处理
│   │   └── font-processor.ts       # 字体处理
│   │
│   ├── utils/                      # 工具函数
│   │   ├── dom.ts                  # DOM 操作辅助
│   │   ├── url.ts                  # URL 解析与相对化
│   │   ├── compression.ts          # 压缩逻辑 (gzip/brotli)
│   │   └── types.ts                # 全局类型定义
│   │
│   ├── models/                     # 数据模型
│   │   ├── resource.ts             # 资源实体 (Resource)
│   │   └── options.ts              # 配置选项接口
│   │
│   └── bootstrap/                  # 运行时注入与环境适配
│       ├── injector.ts             # 脚本注入逻辑
│       ├── content-script.ts       # 内容脚本逻辑 (模拟原 single-file-frames.js)
│       └── polyfills.ts            # 必要的垫片
│
├── tests/                          # 测试用例
│   ├── unit/
│   └── integration/
│
├── vite.config.ts                  # Vite 配置 (库模式)
├── tsconfig.json                   # TypeScript 配置
└── package.json
```

