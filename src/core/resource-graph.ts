// src/core/resource-graph.ts

import { Resource } from '../models/resource';

/**
 * 资源依赖图（当前简化为资源集合）
 * 未来可支持：依赖顺序、循环检测、懒加载资源等
 */
export class ResourceGraph {
  private resources: Resource[] = [];

  /**
   * 添加一个已处理的资源
   */
  addResource(resource: Resource): void {
    this.resources.push(resource);
  }

  /**
   * 获取所有资源
   */
  getResources(): Resource[] {
    return this.resources;
  }

  /**
   * 按类型过滤资源
   */
  getResourcesByType(type: string): Resource[] {
    return this.resources.filter(r => r.type === type);
  }

  /**
   * 清空图（用于重用实例）
   */
  clear(): void {
    this.resources = [];
  }

  /**
   * 资源总数
   */
  size(): number {
    return this.resources.length;
  }
}
