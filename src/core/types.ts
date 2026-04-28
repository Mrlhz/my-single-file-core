// src/core/types.ts

export interface ArchivingOptions {
  // 超时时间、是否压缩等配置
  timeout?: number;
  compress?: boolean;
}

export interface ArchivedResource {
  type: 'style' | 'image' | 'script' | 'font' | 'empty';
  data: any; // 具体的资源数据 (CSS字符串, Base64字符串, 或修改后的DOM节点)
  originalNode?: Element;
  originalUrl?: string | null; // 可选的原始URL，供后续处理器使用
  mimeType?: string; // 可选的 MIME 类型，供后续处理器使用
}
export interface ArchivedResources {
  type: 'style' | 'image' | 'script' | 'font' | 'empty';
  data: any; // 
  originalNode?: Element;
}

/**
 * 图片资源类
 */
export interface ArchivingImageData {
  archiverId: string; // 唯一标识符，供后续处理器使用
  url: string | null;
  content: string | null; // base64 数据或其他格式，供后续处理器使用
  currentSrc: string | null;
  size: { width: number; height: number };
  boxShadow: string | null;
  backgroundImage: string | null;
  backgroundColor: string | null;
}

export interface ArchivingResult {
  html: string; // 最终的归档HTML字符串
  resources: ArchivedResource[]; // 处理过程中收集到的资源信息
}

// 上下文对象，贯穿整个归档过程
export interface ArchivingContext {
  pageUrl: string;
  options: ArchivingOptions;
  // 资源图实例，处理器可读写，供整个归档过程使用
  graph: any; // 这里使用 any 是为了避免循环依赖，实际类型应为 ResourceGraph
  // 批量请求工具，供处理器使用，避免重复请求和优化网络性能
  bathRequest: any; // 这里使用 any 是为了避免循环依赖，实际类型应为 BatchRequest
  // 缓存 Map: Key 是绝对 URL, Value 是处理后的数据 (如 Base64)
  cache: Map<string, string>;
}

// 处理器接口
export interface ResourceProcessor {
  match(node: Element): boolean;
  process(node: Element, context: ArchivingContext): Promise<ArchivedResource>;
}

/**
 * 文档预处理器接口 (策略模式)
 * 预处理器在正式资源处理前对整个文档进行一次扫描和修改，适合做全局性的调整和优化
 * 预处理器可以修改 DOM 结构、添加全局元数据、调整资源引用等，为后续的资源处理器提供更干净和优化的输入
 * 预处理器的执行时机是在资源处理器之前，且只执行一次，适合做全局性的调整和优化
 * 所有全局性的清洗、提取任务都应实现此接口
 * 预处理器可以访问和修改归档上下文中的 metadata 字段，存储全局数据供后续处理器使用
 * 预处理器的设计使得整个归档流程更加模块化和可扩展，用户可以根据需要添加或替换预处理器来实现不同的清洗和优化策略
 * 预处理器的执行顺序由用户配置决定，用户可以根据需要添加多个预处理器，系统会按照配置的顺序依次执行它们
 */
export interface IDocPreprocessor {
  /**
   * 执行预处理逻辑
   * @param doc 当前文档 (通常是 cloneNode 后的副本)
   * @param context 归档上下文
   */
  process(doc: Document, context: ArchivingContext): Promise<void> | void;
}


// 资源收集器接口定义
export interface CollectProcessor {
  /**
   * 判断当前元素是否匹配该收集器的处理条件
   * @param node 当前元素
   * @returns 是否匹配
   */
  match(node: Element): boolean;

  /**
   * 处理匹配的元素，提取资源信息并返回
   * @param node 当前元素
   * @param context 归档上下文，包含一些全局信息和工具方法
   * @returns 处理结果，包括资源信息和可能的修改指令
   */
  process(node: Element, context: ArchivingContext): Promise<ArchivingImageData> | ArchivingImageData;
}

export type StyleProcessor = import('@/processors/style-processor').StyleProcessor;

export type ImageProcessor = import('@/processors/image-processor').ImageProcessor;

// export type ScriptProcessor = import('./script-processor').ScriptProcessor;

// export type FontProcessor = import('./font-processor').FontProcessor;
