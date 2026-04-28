// src/processors/image-processor.ts

import { ResourceProcessor, ArchivingContext, ArchivedResource } from '../core/types';
import { resolveUrl, getMimeType } from '../utils/url';
import { fetchBlob } from '../utils/network';

/**
 * 图片资源处理器
 * 处理 <img>, <picture>, <source> 标签
 */
export class ImageProcessor implements ResourceProcessor {
  // 用于存储收集到的 CSS 变量和图片数据，供最后注入 DOM 使用
  private static cssVariables: Map<string, { base64: string; width: number; height: number }> = new Map();
  private static hasInjectedStyle = false;
  // 常见的懒加载属性名
  private static LAZY_SRC_ATTRIBUTES = ['data-src', 'data-lazy-src', 'data-original', 'ng-src'];

  /**
   * 判断节点类型
   */
  match(node: Element): boolean {
    const tagName = node.tagName.toLowerCase();
    return tagName === 'img' || tagName === 'source' || tagName === 'input'; // input type="image"
  }

  /**
   * 核心处理逻辑
   */
  async process(node: Element, context: ArchivingContext): Promise<ArchivedResource> {
    const tagName = node.tagName.toLowerCase();
    const resources: ArchivedResource[] = [];

    try {
      let dataUri: string | null = null;
      let originalUrl: string | null = null;
      if (tagName === 'img') {
        // dataUri = await this.processImgNode(node as HTMLImageElement, context);
        originalUrl = await this.processImgNode(node as HTMLImageElement, context);
      } else if (tagName === 'source') {
        await this.processSourceNode(node as HTMLSourceElement, context);
      } else if (tagName === 'input') {
        await this.processInputNode(node as HTMLInputElement, context);
      }

      // 注意：对于 picture/img 结构，我们可能返回多个资源（原图 + srcset 中的图）
      // 但为了简化架构，我们通常返回一个包含所有变更信息的资源，或者让核心层处理 DOM 更新
      // 这里我们返回一个标记为 'image-container' 的资源，指示核心层该节点已处理
      return {
        type: 'image',
        data: dataUri, // 主要是为了缓存和后续处理，核心层不直接使用这个 dataUri，而是根据 node 的变化来生成最终资源
        originalNode: node,
        originalUrl
      };

    } catch (err) {
      console.error(`[ImageProcessor] Error processing image: ${err}`, node);
      return { type: 'image', data: node }; // 失败则保留原样
    }
  }

  /**
   * 处理 <img> 标签
   */
  private async processImgNode(img: HTMLImageElement, context: ArchivingContext) {
    // 1. 确定真实的图片 URL
    // 优先检查懒加载属性，如果没有则使用 src
    let srcUrl = this.getRealSrc(img);
    if (!srcUrl || srcUrl.startsWith('data:')) return null; // 已经是 data uri 或无效

    const absoluteUrl = resolveUrl(srcUrl, context.pageUrl);
    return absoluteUrl; // 这里我们不直接下载和转换图片，而是返回绝对 URL，交给核心层统一处理，避免重复请求和性能问题（其他处理器根据 URL 来获取和处理图片数据）

    // // 2. 下载并转换 (带缓存)
    // const dataUri = await this.fetchAndConvert(absoluteUrl, context);
    
    // // 3. 更新 DOM
    // if (dataUri) {
    //   img.src = dataUri;
    //   // 移除懒加载属性，防止页面加载时再次触发懒加载逻辑
    //   ImageProcessor.LAZY_SRC_ATTRIBUTES.forEach(attr => img.removeAttribute(attr));
    //   img.removeAttribute('loading'); 
    // }

    // // 4. 处理 srcset (响应式图片)
    // if (img.srcset) {
    //   await this.processSrcSet(img, context);
    // }

    // return dataUri;
  }

  /**
   * 处理 <source> 标签 (通常用于 <picture> 或 <video>)
   */
  private async processSourceNode(source: HTMLSourceElement, context: ArchivingContext) {
    // 处理 srcset (source 标签通常使用 srcset 而不是 src)
    if (source.srcset) {
      await this.processSrcSet(source, context);
    } 
    // 某些浏览器支持 source 的 src 属性
    else if (source.src) {
        const absoluteUrl = resolveUrl(source.src, context.pageUrl);
        const dataUri = await this.fetchAndConvert(absoluteUrl, context);
        if (dataUri) source.src = dataUri;
    }
  }

  /**
   * 处理 <input type="image">
   */
  private async processInputNode(input: HTMLInputElement, context: ArchivingContext) {
     let srcUrl = this.getRealSrc(input);
     if (!srcUrl || srcUrl.startsWith('data:')) return;

     const absoluteUrl = resolveUrl(srcUrl, context.pageUrl);
     const dataUri = await this.fetchAndConvert(absoluteUrl, context);
     if (dataUri) input.src = dataUri;
  }

  /**
   * 处理 srcset 属性
   * srcset 格式示例: "img-320w.jpg 320w, img-480w.jpg 480w, img-800w.jpg 800w"
   */
  private async processSrcSet(
    element: HTMLImageElement | HTMLSourceElement, 
    context: ArchivingContext
  ) {
    const srcset = element.srcset;
    if (!srcset) return;

    const candidates = srcset.split(',').map(part => {
      const trimmed = part.trim();
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex === -1) {
        return { url: trimmed, descriptor: '' };
      }
      return {
        url: trimmed.substring(0, spaceIndex),
        descriptor: trimmed.substring(spaceIndex + 1).trim()
      };
    });

    // 并行处理所有分辨率的图片
    const processedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        if (candidate.url.startsWith('data:')) return candidate;

        const absoluteUrl = resolveUrl(candidate.url, context.pageUrl);
        const dataUri = await this.fetchAndConvert(absoluteUrl, context);
        
        return {
          url: dataUri || candidate.url, // 如果失败保留原 URL
          descriptor: candidate.descriptor
        };
      })
    );

    // 重新组装 srcset 字符串
    const newSrcSet = processedCandidates
      .map(c => c.descriptor ? `${c.url} ${c.descriptor}` : c.url)
      .join(', ');

    element.srcset = newSrcSet;
  }

  /**
   * 通用的获取真实图片地址的方法
   * 处理懒加载逻辑
   */
  private getRealSrc(element: Element): string | null {
    // 1. 如果已经有 src 且不是占位符，直接用
    const src = element.getAttribute('src');
    if (src && !this.isPlaceholder(src)) {
      return src;
    }

    // 2. 查找常见的懒加载属性
    for (const attr of ImageProcessor.LAZY_SRC_ATTRIBUTES) {
      const val = element.getAttribute(attr);
      if (val) return val;
    }

    return src;
  }

  /**
   * 判断是否是透明占位图 (常见的 1x1 gif 或 base64 占位)
   */
  private isPlaceholder(src: string): boolean {
    // 简单判断：如果是 data uri 且非常短，或者是常见的透明 gif
    if (src.startsWith('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')) {
      return true;
    }
    return false;
  }

  /**
   * 核心下载与转换逻辑 (带缓存)
   */
  private async fetchAndConvert(url: string, context: ArchivingContext): Promise<string | null> {
    // 1. 检查缓存
    if (context.cache.has(url)) {
      return context.cache.get(url) || null;
    }

    try {
      // 2. 下载 Blob
      const blob = await fetchBlob(url, context.options);
      
      // 3. 获取 MIME 类型
      const mimeType = blob.type || getMimeType(url) || 'image/jpeg';

      // 4. 转 Base64
      const dataUri = await this.blobToDataUri(blob, mimeType);

      // 5. 存入缓存
      context.cache.set(url, dataUri);

      return dataUri;
    } catch (err) {
      console.warn(`[ImageProcessor] Failed to fetch image: ${url}`, err);
      return null;
    }
  }

  private blobToDataUri(blob: Blob, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
