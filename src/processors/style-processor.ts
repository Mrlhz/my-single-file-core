import * as csstree from 'css-tree';
import { ResourceProcessor, ArchivingContext, ArchivedResource } from '../core/types';
import { resolveUrl, getMimeType, blobToDataUri } from '../utils/url';
import { fetchText, fetchBlob } from '../utils/network';

/**
 * 样式处理器
 * 1. 处理 <link rel="stylesheet"> 和 <style> 标签
 * 2. 解析 CSS 内容，找到 url() 引用的资源，进行内联处理
 * 3. 返回处理后的 CSS 字符串供归档使用
 * 4. 对于 @import 的处理：css-tree 在解析时会自动解析 @import 的 URL，但不会自动下载和内联内容，我们需要在 walk 中手动处理 Atrule 节点来实现 @import 的展开。
 *    - 当遇到 @import 时，解析其 URL，下载内容，递归调用 processWithAst 来处理该 CSS 内容，并将结果直接插入到主 AST 中，替换原来的 @import 规则。
 *    - 这样最终生成的 CSS 就是完全展开的，没有任何外部依赖了。
 * 5. 对于 url() 的处理：直接修改 AST 中 Url 节点的 value 为内联后的 Data URI，这样在生成 CSS 字符串时就会自动使用内联资源。
 * 6. 错误处理：如果下载或处理某个资源失败，应该记录日志但不抛出错误，保持原有 URL 不变，确保归档过程的鲁棒性。
 * 7. 性能优化：对于大型 CSS 文件，解析和处理可能比较耗时，可以考虑增加缓存机制，避免重复处理同一资源。
 * 8. 安全性：处理 CSS 时要注意潜在的安全问题，如恶意的 @import URL 或 url() 引用，应该有合理的超时和错误处理机制，避免被恶意资源拖慢或崩溃。
 * 9. 兼容性：需要考虑不同浏览器对 CSS 语法的支持差异，css-tree 的解析选项可以调整以适应不同的 CSS 版本和特性。
 * 10. 可扩展性：设计时要考虑未来可能需要支持更多 CSS 特性或处理更多类型的资源，保持代码结构清晰和模块化。
 */
export class StyleProcessor implements ResourceProcessor {

  /**
   * 判断当前节点是否由该处理器处理
   */
  match(node: Element): boolean {
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'link') {
      const rel = node.getAttribute('rel')?.toLowerCase();
      const type = node.getAttribute('type')?.toLowerCase();
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
    let cssUrl = context.pageUrl; // 默认基准 URL

    try {
      if (tagName === 'link') {
        const href = node.getAttribute('href');
        if (!href) return { type: 'empty', data: '' };

        cssUrl = resolveUrl(href, context.pageUrl);
        // 下载 CSS 内容
        cssText = await fetchText(cssUrl, context.options);
      } else if (tagName === 'style') {
        // 处理 <style> 标签
        cssText = node.textContent || '';
      }

      // 使用 css-tree 进行 AST 解析和处理
      const processedCss = await this.processWithAst(cssText, cssUrl, context);

      return {
        type: 'style',
        data: processedCss,
        originalNode: node,
      };

    } catch (err) {
      console.error(`[StyleProcessor] Failed to process style: ${err}`, node);
      return { type: 'style', data: cssText };
    }
  }

  /**
   * 使用 css-tree 解析并处理 CSS
   */
  private async processWithAst(cssText: string, cssUrl: string, context: ArchivingContext): Promise<string> {
    // 1. 解析 CSS 为 AST
    // parseAtrulePrelude: false 提高性能，我们主要关心值
    const ast = csstree.parse(cssText, {
      positions: true, 
      filename: cssUrl // 关键：告诉 css-tree 当前文件的 URL，用于 @import 解析
    });

    // 1. 收集所有 URL
    const urlNodes: csstree.Url[] = [];

    csstree.walk(ast, {
      visit: 'Url',
      enter(node) {
        // node.value 是 url() 括号里的字符串内容（不含引号）
        const rawUrl = node.value;
        if (rawUrl && !rawUrl.startsWith('data:')) {
          urlNodes.push(node);
        }
      }
    });

    // 2. 并发下载所有资源 (异步)
    await Promise.all([...urlNodes].map(async (node) => {
      const absoluteUrl = resolveUrl(node.value, cssUrl);
      try {
        if (context.cache.has(absoluteUrl)) {
          node.value = context.cache.get(absoluteUrl);
        } else {
          const blob = await fetchBlob(absoluteUrl, context.options);
          const mimeType = blob.type || getMimeType(absoluteUrl);
          const dataUri = await blobToDataUri(blob, mimeType || 'application/octet-stream');

          context.cache.set(absoluteUrl, dataUri);
          node.value = dataUri; // 修改 AST 节点
        }
      } catch (e) {
        console.warn(`Failed to fetch: ${node.value}`, e);
      }
    }));

    // 3. 生成 CSS (此时所有 node.value 已更新)
    return csstree.generate(ast);
  }

}
