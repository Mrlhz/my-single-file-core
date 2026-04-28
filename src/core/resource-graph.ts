// src/core/resource-graph.ts

import { Resource } from '../models/resource';
import type { ArchivingImageData } from '@/core/types';

// 'canvas' | 'image' | 'poster' | 'video' | 'usedFont' | 'shadowRoot' | 'markedElement'
export type elementsType = 'canvases' | 'images' | 'posters' | 'videos' | 'usedFonts' | 'shadowRoots' | 'markedElements';

/**
 * 资源依赖图（当前简化为资源集合）
 * 未来可支持：依赖顺序、循环检测、懒加载资源等
 */
export class ResourceGraph {
  private resources: Resource[] = [];
  private elementsInfo: Map<elementsType, any[]> = new Map(); // 用于存储不同类型元素的列表，供后续预处理器使用
  private images: any[] = []; // 存储图片元素的信息，供后续预处理器使用

  // 图片url和资源对象的映射，供后续预处理器使用
  private imageUrlToResourceMap: Map<string, ArchivingImageData> = new Map();

  // css全局变量列表，供后续预处理器使用
  private cssVariables: Map<string, string> = new Map();
  // private resourceDependencies: Map<string, Set<string>> = new Map(); // 资源依赖关系图，Key 是资源 URL，Value 是该资源依赖的其他资源 URL 的集合

  constructor() {
    // 初始化资源图
    this.elementsInfo.set('images', this.images); // 初始化图片元素列表，供后续预处理器使用
    this.elementsInfo.set('canvases', []); // 初始化 canvas 元素列表，供后续预处理器使用
    this.elementsInfo.set('posters', []); // 初始化 video poster 元素列表，供后续预处理器使用
    this.elementsInfo.set('videos', []); // 初始化 video 元素列表，供后续预处理器使用
    this.elementsInfo.set('usedFonts', []); // 初始化已使用字体列表，供后续预处理器使用
    this.elementsInfo.set('shadowRoots', []); // 初始化 Shadow DOM 列表，供后续预处理器使用
    this.elementsInfo.set('markedElements', []); // 初始化被标记元素列表，供后续预处理器使用

    this.cssVariables = new Map(); // 初始化 CSS 全局变量列表，供后续预处理器使用
    this.imageUrlToResourceMap = new Map(); // 初始化图片 URL 到 Resource 对象的映射，供后续预处理器使用
  }

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

  addElementInfo(type: elementsType, info: any): void {
    if (!this.elementsInfo.has(type)) {
      this.elementsInfo.set(type, []);
    }
    this.elementsInfo.get(type)!.push(info);
  }

  getElementInfo(type: elementsType): any[] {
    return this.elementsInfo.get(type) || [];
  }

  getAllElementInfo(): Map<elementsType, any[]> {
    return this.elementsInfo;
  }

  // 设置 CSS 全局变量
  setCSSVariable(name: string, value: string): void {
    this.cssVariables.set(name, value);
  }

  // 获取 CSS 全局变量
  getCSSVariable(name: string): string | undefined {
    return this.cssVariables.get(name);
  }

  // 获取所有 CSS 全局变量对象
  getAllCSSVariables(): Record<string, string> {
    return Object.fromEntries(this.cssVariables.entries());
  }
  // 获取CSS 全局变量
  getCSSVariables(): Map<string, string> {
    return this.cssVariables;
  }

  setImageResource(url: string, resource: ArchivingImageData): void {
    this.imageUrlToResourceMap.set(url, resource);
  }
  getImageResource(url: string): ArchivingImageData | undefined {
    return this.imageUrlToResourceMap.get(url);
  }
}
