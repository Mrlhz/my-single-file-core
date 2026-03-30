// src/core/index.ts
import { PageArchiver } from './page-archiver';
import { StyleProcessor } from '../processors/style-processor';
// import other processors...

const archiver = new PageArchiver({
  timeout: 20000,
  inlineStyles: true
});

archiver.registerProcessor(new StyleProcessor());
// archiver.registerProcessor(new ImageProcessor());

export { archiver, PageArchiver };


// 在 content script 中使用
// // content-script.js
// import { archiver } from 'my-single-file';

// const html = await archiver.archive(document);
// // 发送 html 到 background script 或保存
// chrome.runtime.sendMessage({ action: 'savePage', html });