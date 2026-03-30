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
}

// 上下文对象，贯穿整个归档过程
export interface ArchivingContext {
  pageUrl: string;
  options: ArchivingOptions;
  // 缓存 Map: Key 是绝对 URL, Value 是处理后的数据 (如 Base64)
  cache: Map<string, string>; 
}

// 处理器接口
export interface ResourceProcessor {
  match(node: Element): boolean;
  process(node: Element, context: ArchivingContext): Promise<ArchivedResource>;
}
