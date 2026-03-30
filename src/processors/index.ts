// src/processors/index.ts

export * from './style-processor';
// export * from './image-processor';
// export * from './script-processor';
// export * from './font-processor';

// 统一 ResourceProcessor 接口
export interface ResourceProcessor {
  match(node: Element): boolean;
  process(node: Element, context: import('../models/options').ArchivingContext): Promise<import('../models/options').ArchivedResource>;
}
