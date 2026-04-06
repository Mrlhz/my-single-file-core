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

    // 2. 遍历 AST 查找 url() 节点
    // css-tree 会自动处理 @import 的 url 和 background-image 的 url
    await csstree.walk(ast, {
      visit: 'Url',
      async enter(node) {
        // node.value 是 url() 括号里的字符串内容（不含引号）
        const rawUrl = node.value;

        if (!rawUrl || rawUrl.startsWith('data:')) {
          return; // 跳过 data URI
        }

        try {
          // 3. 解析绝对路径
          // css-tree 的 generate 方法在遇到 @import 时会自动基于 filename 解析相对路径
          // 但我们需要手动 resolve 以确保万无一失，特别是针对 node.value
          // 注意：node.loc.source.filename 是当前 CSS 文件的路径
          const currentFileUrl = node.loc?.source?.filename || cssUrl;
          const absoluteUrl = resolveUrl(rawUrl, currentFileUrl);

          // --- 调试日志 ---
          console.log(`[StyleProcessor] Processing URL: ${rawUrl} -> ${absoluteUrl}`);

          // 4. 检查缓存或下载
          if (context.cache.has(absoluteUrl)) {
            node.value = context.cache.get(absoluteUrl);
          } else {
            const blob = await fetchBlob(absoluteUrl, context.options);
            const mimeType = blob.type || getMimeType(absoluteUrl) || 'application/octet-stream';
            const dataUri = await blobToDataUri(blob, mimeType);
            
            context.cache.set(absoluteUrl, dataUri);
            node.value = dataUri; // 直接修改 AST 节点的值

                    // 确认赋值成功
                    console.log(`[StyleProcessor] Converted to Base64 (${dataUri.slice(0, 100)}...): ${absoluteUrl}`);
          }
        } catch (e) {
          console.warn(`[StyleProcessor] Failed to inline: ${rawUrl}`, e);
          // 失败则保持原样，不修改 node.value
        }
      }
    });

    // 5. 将 AST 重新生成 CSS 字符串
    // 这一步会自动处理 @import 的展开（如果之前没有展开的话，但通常 walk 不会自动展开 @import 内容）
    // 注意：css-tree 的 walk 默认不会自动把 @import 的内容“插入”到主文件中。
    // 如果你需要展开 @import，需要单独处理 Atrule 节点（见下方补充）。
    
    return csstree.generate(ast);
  }

}
