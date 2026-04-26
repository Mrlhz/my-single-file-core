// src/core/page-archiver.ts

import type { ArchivingOptions, ArchivingContext, ArchivedResource } from '../models/options';
import { ResourceGraph } from './resource-graph';
import { createResourceFromNode } from '../models/resource'; // 工厂函数
import { IDocPreprocessor, CollectProcessor, ResourceProcessor } from './types';
import { collectAndMarkResourceNodes, collectResourceNodes } from '../utils/dom';

/**
 * 页面归档主类
 */
export class PageArchiver {
  // 资源处理器列表
  private collectProcessors: CollectProcessor[] = [];
  // 预处理器列表
  private preprocessors: IDocPreprocessor[] = [];
  private processors: ResourceProcessor[] = [];
  private options: ArchivingOptions;
  private graph: ResourceGraph;
  private removedElements: Element[] = []; // 用于存储被标记为移除的元素，供后续处理

  constructor(options: Partial<ArchivingOptions> = {}) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };

    this.graph = new ResourceGraph();
  }

  // 注册文档预处理器（策略模式）
  registerPreprocessor(preprocessor: IDocPreprocessor): void {
    this.preprocessors.push(preprocessor);
  }

  // 批量注册预处理器
  registerPreprocessors(preprocessors: IDocPreprocessor[]): void {
    this.preprocessors.push(...preprocessors);
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
    // 构建归档上下文
    const context: ArchivingContext = {
      pageUrl: doc instanceof Document ? doc.location?.href || '' : window.location.href,
      options: this.options,
      graph: this.graph, // 让处理器也能访问图结构，便于资源间关联（如 CSS 引用的图片）
      cache: new Map<string, string>() // URL -> DataURI 缓存
    };

    // 收集所有可能包含外部资源的 DOM 节点（如 <img>、<link>、<script> 等），并为每个节点打上唯一 ID 以便后续处理器定位
    await this.runCollectProcessors(context);

    // 1. 克隆文档 (在此处克隆，确保原始页面不受影响)
    // 注意：如果是跨域 iframe 内容，cloneNode 可能无法复制某些属性，需注意
    const workingDoc = doc instanceof Document ? doc.cloneNode(true) as Document : doc.cloneNode(true) as HTMLElement;

    // 2. 【关键步骤】执行预处理任务 (清洗、提取元数据)
    await this.runPreprocessors(workingDoc, context);

    // 3. 收集所有待处理节点
    const nodesToProcess = collectResourceNodes(workingDoc);

    // 4. 构建资源图
    // const graph = new ResourceGraph();
    // context.resourceGraph = graph; // 让处理器也能访问图结构，便于资源间关联（如 CSS 引用的图片）

    // 5. 并行处理节点 (图片、CSS、字体等)
    const processingPromises = nodesToProcess.map(async (node) => {
      const processor = this.findProcessorFor(node);
      if (!processor) {
        // console.warn('[PageArchiver] No processor found for node:', node);
        return null;
      }

      try {
        const archived = await processor.process(node, context);
        const resource = createResourceFromNode(node, archived);
        this.graph.addResource(resource);
        return resource;
      } catch (err) {
        console.error('[PageArchiver] Processor failed:', err, node);
        return null;
      }
    });

    await Promise.all(processingPromises);

    // 6. 序列化为单文件 HTML
    const serialized = this.serialize(workingDoc, this.graph, context);
    return serialized;
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

  /**
   * 执行所有预处理器
   */
  private async runPreprocessors(doc: Document, context: ArchivingContext): Promise<void> {
    // 按注册顺序串行执行，因为某些预处理器可能依赖前一个的结果
    for (const preprocessor of this.preprocessors) {
      try {
        await preprocessor.process(doc, context);
      } catch (err) {
        console.error('[PageArchiver] Preprocessor failed:', err, preprocessor.constructor.name);
        // 这里选择继续执行，而不是中断整个流程，除非是致命错误
      }
    }
  }

  // 批量注册收集器（策略模式）
  registerCollectProcessors(collectProcessors: CollectProcessor[]): void {
    this.collectProcessors.push(...collectProcessors);
  }
  // 运行所有资源处理器
  private async runCollectProcessors(context: ArchivingContext): Promise<void> {
    const { nodes } = collectAndMarkResourceNodes(document);
    const processingPromises = nodes.map(async (node) => {
      const processor = this.collectProcessors.find(p => p.match(node));
      if (!processor) {
        return null;
      }
      try {
        await processor.process(node, context);
      } catch (error) {
        console.log('[PageArchiver] Collect processor failed:', error, processor.constructor.name);
      }
    });
    await Promise.all(processingPromises);
  }

  getResourceGraph() {
    // 这里可以返回当前的资源图实例，供外部查询或调试
    // 注意：如果需要在处理器中访问图结构，建议在 context 中传递图实例
    return this.graph; // 目前每次调用都会返回新实例，实际项目中应保持单例或适当管理生命周期
  }
}
