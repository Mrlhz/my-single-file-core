// src/models/options.ts

import { BatchRequest } from '@/utils/BatchRequest';
import { ResourceGraph } from '../core/resource-graph';

/**
 * 用户可配置的归档选项
 */
export interface ArchivingOptions {
  /**
   * 是否移除所有 <script> 标签（默认 false，仅内联）
   */
  removeScripts?: boolean;

  /**
   * 是否内联样式（<link rel=stylesheet> 和 <style>）
   */
  inlineStyles?: boolean;

  /**
   * 是否对最终 HTML 进行压缩（gzip/brotli 后 base64 嵌入 meta？暂不实现，留扩展）
   */
  compressHtml?: boolean;

  /**
   * 单个资源最大大小（字节），超过则跳过内联（默认 10MB）
   */
  maxResourceSize?: number;

  /**
   * 网络请求超时（毫秒，默认 30 秒）
   */
  timeout?: number;

  /**
   * 是否保留原始 URL 注释（用于调试）
   */
  keepOriginalUrls?: boolean;
}

/**
 * 归档过程中的运行时上下文
 */
export interface ArchivingContext {
  /**
   * 当前页面的完整 URL
   */
  pageUrl: string;

  /**
   * 用户传入的选项
   */
  options: ArchivingOptions;

  /**
   * 资源图实例，处理器可读写，供整个归档过程使用
   */
  graph: ResourceGraph;

  /**
   * 批量请求工具，供处理器使用，避免重复请求和优化网络性能
   */
  bathRequest: BatchRequest;

  /**
   * 资源缓存：URL -> DataURI，避免重复下载
   */
  cache: Map<string, string>;
  /**
   * 用于存储预处理阶段产生的全局数据（如已处理的资源列表、页面元数据等），供后续阶段使用
   * 页面元数据（如 title、favicon 等），处理器可读写，最终嵌入 HTML
   */
  metadata?: {
    favicon?: string; // 保存处理后的 favicon dataURI
    title?: string;
    [key: string]: any;
  };
}

/**
 * 处理器返回的已归档资源
 */
export interface ArchivedResource {
  /**
   * 资源类型（与处理器 match 逻辑一致）
   */
  type: 'image' | 'style' | 'script' | 'font' | 'empty' | string;

  /**
   * 内联后的内容：
   * - 图片/字体：data:image/png;base64,...
   * - CSS/JS：纯文本
   */
  data: string;

  /**
   * 原始 DOM 节点引用（用于后续替换）
   */
  originalNode?: Element;
}
