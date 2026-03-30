// src/core/page-archiver.ts

import type { ResourceProcessor } from '../processors/index';
import { ResourceGraph } from './resource-graph';
import type { ArchivingOptions, ArchivingContext, ArchivedResource } from '../models/options';
import type { Resource } from '../models/resource';
import { createResourceFromNode } from '../models/resource'; // 假设的工厂函数

/**
 * 页面归档主类
 */
export class PageArchiver {
  private processors: ResourceProcessor[] = [];
  private options: ArchivingOptions;

  constructor(options: Partial<ArchivingOptions> = {}) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  /**
   * 注册资源处理器（策略模式）
   */
  registerProcessor(processor: ResourceProcessor): void {
    this.processors.push(processor);
  }

  /**
   * 批量注册处理器
   */
  registerProcessors(processors: ResourceProcessor[]): void {
    this.processors.push(...processors);
  }

  /**
   * 主归档入口
   */
  async archive(doc: Document | HTMLElement): Promise<string> {
    const context: ArchivingContext = {
      pageUrl: doc instanceof Document ? doc.location?.href || '' : window.location.href,
      options: this.options,
      cache: new Map<string, string>() // URL -> DataURI 缓存
    };

    // 1. 收集所有待处理节点
    const nodesToProcess = this.collectNodes(doc);

    // 2. 构建资源图
    const graph = new ResourceGraph();

    // 3. 并行处理节点
    const processingPromises = nodesToProcess.map(async (node) => {
      const processor = this.findProcessorFor(node);
      if (!processor) {
        console.warn('[PageArchiver] No processor found for node:', node);
        return null;
      }

      try {
        const archived = await processor.process(node, context);
        const resource = createResourceFromNode(node, archived);
        graph.addResource(resource);
        return resource;
      } catch (err) {
        console.error('[PageArchiver] Processor failed:', err, node);
        return null;
      }
    });

    await Promise.all(processingPromises);

    // 4. 序列化为单文件 HTML
    const serialized = this.serialize(doc, graph, context);
    return serialized;
  }

  /**
   * 收集所有可能包含外部资源的 DOM 节点
   */
  private collectNodes(root: Document | HTMLElement): Element[] {
    const walker = document.createTreeWalker(
      root instanceof Document ? root.documentElement : root,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    const nodes: Element[] = [];
    let node: Element | null;
    while ((node = walker.nextNode() as Element | null)) {
      node.setAttribute('data-archiver-id', `${nodes.length}`); // 给每个节点打上唯一 ID 以便后续定位
      nodes.push(node);
    }
    return nodes;
  }

  /**
   * 为节点查找匹配的处理器
   */
  private findProcessorFor(node: Element): ResourceProcessor | null {
    for (const processor of this.processors) {
      if (processor.match(node)) {
        return processor;
      }
    }
    return null;
  }

  /**
   * 将处理后的资源图注入回 HTML 并序列化
   */
  private serialize(
    originalDoc: Document | HTMLElement,
    graph: ResourceGraph,
    context: ArchivingContext
  ): string {
    // 克隆文档以避免污染原始页面
    const clone = originalDoc.cloneNode(true) as Document | HTMLElement;

    // 替换原始节点为内联资源（例如 <img> 的 src 改为 data:）
    graph.getResources().forEach((resource) => {
      if (!resource.originalNode) return;

      // 在克隆文档中找到对应节点（通过位置或标记？这里简化：假设引用有效）
      // 实际中可能需要用唯一 ID 或 XPath 定位
      const clonedNode = this.findCorrespondingNode(clone, resource.originalNode);
      if (!clonedNode) return;

      // 调用资源的 apply 方法（需在 Resource 类中定义）
      resource.applyTo(clonedNode);
    });

    // 序列化为字符串
    if (clone instanceof Document) {
      return new XMLSerializer().serializeToString(clone);
    } else {
      return clone.outerHTML;
    }
  }

  /**
   * 在克隆树中查找对应节点（简化版：仅用于演示）
   * 实际项目中建议在 collect 阶段给节点打唯一标记（如 data-archiver-id）
   */
  private findCorrespondingNode(cloneRoot: Document | HTMLElement, original: Element): Element | null {
    // TODO: 更健壮的映射机制
    return cloneRoot.querySelector(`[data-archiver-id="${original.getAttribute('data-archiver-id')}"]`);
  }

  private getDefaultOptions(): ArchivingOptions {
    return {
      removeScripts: false,
      inlineStyles: true,
      compressHtml: false,
      maxResourceSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000
    };
  }
}
