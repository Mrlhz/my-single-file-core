import { ResourceProcessor, ArchivingContext, ArchivedResource } from '../core/types'; // 假设的通用接口
import { resolveUrl, getMimeType } from '../utils/url';
import { fetchText, fetchBlob } from '../utils/network'; // 假设的网络请求工具

/**
 * CSS 资源处理器
 * 负责处理 <link> 和 <style> 标签，提取其中的 CSS 文本及引用的资源（图片、字体、@import）
 */
export class StyleProcessor implements ResourceProcessor {
  // 匹配 @import 规则的正则
  private static IMPORT_REGEX = /@import\s+(?:url$['"]?([^'"]+)['"]?$|['"]([^'"]+)['"])/gi;
  // 匹配 url() 的正则 (排除 @import 已处理的情况，通常用于 background, font-face 等)
  private static URL_REGEX = /url$\s*['"]?([^'")\s]+)['"]?\s*$/gi;

  /**
   * 判断当前节点是否由该处理器处理
   */
  match(node: Element): boolean {
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'link') {
      const rel = node.getAttribute('rel')?.toLowerCase();
      const type = node.getAttribute('type')?.toLowerCase();
      // 匹配 rel="stylesheet" 或 type="text/css"
      return rel === 'stylesheet' || type === 'text/css';
    }
    return tagName === 'style';
  }

  /**
   * 核心处理逻辑
   */
  async process(node: Element, context: ArchivingContext): Promise<ArchivedResource> {
    const tagName = node.tagName.toLowerCase();
    let cssText = '';
    let baseUrl = context.pageUrl; // 默认基准 URL 是页面 URL

    try {
      if (tagName === 'link') {
        const href = node.getAttribute('href');
        if (!href) return { type: 'empty', data: '' };

        // 1. 处理外部 CSS 文件
        const absoluteUrl = resolveUrl(href, context.pageUrl);
        baseUrl = absoluteUrl; // 关键点：CSS 中的相对路径是相对于 CSS 文件本身的
        
        // 下载 CSS 内容
        cssText = await fetchText(absoluteUrl, context.options);
        
      } else if (tagName === 'style') {
        // 2. 处理内部 CSS 块
        cssText = node.textContent || '';
      }

      // 3. 解析并替换 CSS 内容中的资源引用
      // 我们需要递归处理 @import，因为 @import 可以嵌套（虽然不推荐，但存在）
      const processedCss = await this.resolveCssImportsAndUrls(cssText, baseUrl, context);

      return {
        type: 'style',
        data: processedCss,
        originalNode: node, // 保留引用以便后续替换 DOM
      };

    } catch (err) {
      console.error(`[StyleProcessor] Failed to process style: ${err}`, node);
      // 失败时返回原始内容或空，取决于策略
      return { type: 'style', data: cssText }; 
    }
  }

  /**
   * 递归处理 CSS 内容
   * 1. 提取 @import 并递归获取其内容
   * 2. 替换 url() 为 DataURI
   */
  private async resolveCssImportsAndUrls(
    cssText: string, 
    baseUrl: string, 
    context: ArchivingContext
  ): Promise<string> {
    let resultCss = cssText;

    // --- 第一步：处理 @import ---
    // 注意：为了不破坏原始字符串的索引，我们从后向前替换，或者使用异步累加器
    // 这里为了代码清晰，使用正则替换配合异步处理
    
    const importMatches = [...cssText.matchAll(StyleProcessor.IMPORT_REGEX)];
    
    // 使用 Promise.all 并行下载所有 @import 的资源
    const importPromises = importMatches.map(async (match) => {
      const url = match[1] || match[2]; // 获取 url(...) 或 "..." 中的路径
      if (!url) return null;

      const absoluteUrl = resolveUrl(url, baseUrl);
      
      try {
        // 递归下载被 import 的 CSS
        const importedCssText = await fetchText(absoluteUrl, context.options);
        // 递归处理被 import CSS 中的 url() 和 @import (基准 URL 变为被 import 文件的 URL)
        return await this.resolveCssImportsAndUrls(importedCssText, absoluteUrl, context);
      } catch (e) {
        console.warn(`Failed to load @import: ${absoluteUrl}`);
        return ''; // 加载失败返回空字符串
      }
    });

    const resolvedImports = await Promise.all(importPromises);

    // 将 @import 语句替换为实际的 CSS 内容
    // 注意：这里简单地按顺序替换。更严谨的做法是使用 replace 回调。
    let importIndex = 0;
    resultCss = resultCss.replace(StyleProcessor.IMPORT_REGEX, () => {
      return resolvedImports[importIndex++] || '';
    });

    // --- 第二步：处理 url() (背景图、字体等) ---
    // 此时 @import 已经被展开，我们只需要处理剩下的 url()
    resultCss = await this.resolveCssUrls(resultCss, baseUrl, context);

    return resultCss;
  }

  /**
   * 处理 CSS 中的 url() 函数，将其转换为 DataURI
   */
  private async resolveCssUrls(cssText: string, baseUrl: string, context: ArchivingContext): Promise<string> {
    // 使用异步替换
    const matches = [...cssText.matchAll(StyleProcessor.URL_REGEX)];
    
    // 收集所有需要替换的任务
    const replacements = await Promise.all(matches.map(async (match) => {
      const url = match[1];
      if (!url || url.startsWith('data:')) {
        return { original: match[0], replacement: match[0] }; // 已经是 data uri 或无效，跳过
      }

      const absoluteUrl = resolveUrl(url, baseUrl);
      
      try {
        // 检查缓存，避免重复下载
        if (context.cache.has(absoluteUrl)) {
           const dataUri = context.cache.get(absoluteUrl);
           return { original: match[0], replacement: `url("${dataUri}")` };
        }

        // 下载资源
        const blob = await fetchBlob(absoluteUrl, context.options);
        const mimeType = getMimeType(absoluteUrl) || 'application/octet-stream';
        
        // 转换为 Base64
        const dataUri = await this.blobToDataUri(blob, mimeType);
        
        // 存入缓存
        context.cache.set(absoluteUrl, dataUri);

        return { original: match[0], replacement: `url("${dataUri}")` };
      } catch (e) {
        console.warn(`Failed to inline CSS resource: ${absoluteUrl}`);
        return { original: match[0], replacement: match[0] }; // 失败保留原样
      }
    }));

    // 执行替换
    let finalCss = cssText;
    replacements.forEach(({ original, replacement }) => {
      // 简单的字符串替换，注意如果有重复的 url 可能会有问题，
      // 严谨做法是使用 replace 回调，但这里为了演示逻辑简化处理
      finalCss = finalCss.replace(original, replacement);
    });

    return finalCss;
  }

  /**
   * 辅助函数：Blob 转 DataURI
   */
  private blobToDataUri(blob: Blob, mimeType: string): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
}
