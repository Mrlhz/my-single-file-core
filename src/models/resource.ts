// src/models/resource.ts

import { IMAGE_ATTRIBUTE_NAME } from '@/utils/constants';
import type { ArchivedResource, ArchivingContext } from './options';
import { getPlaceholderDataURI } from '@/utils/dom';
import { ArchivingImageData } from '@/core/types';

/**
 * 资源类型枚举
 */
export type ResourceType = 'image' | 'style' | 'script' | 'font' | 'other' | 'empty';

/**
 * 资源实体类
 * 表示一个已被处理并可内联的资源
 */
export class Resource {
  public readonly type: ResourceType;
  public readonly data: string; // DataURI 或内联文本
  public readonly originalUrl?: string;
  public readonly mimeType?: string;
  public readonly originalNode: Element | null;

  constructor(params: {
    type: ResourceType;
    data: string;
    originalUrl?: string;
    mimeType?: string;
    originalNode: Element | null;
  }) {
    this.type = params.type;
    this.data = params.data;
    this.originalUrl = params.originalUrl;
    this.mimeType = params.mimeType;
    this.originalNode = params.originalNode;
  }

  /**
   * 将资源应用回 DOM 节点（内联化）
   */
  applyTo(context: ArchivingContext, node: Element): void {
    switch (this.type) {
      case 'image': {
        const img = node as HTMLImageElement;
        // img.src = this.data; // data:image/png;base64,...
        // 移除可能存在的 srcset/lazy loading
        img.removeAttribute('srcset');
        img.removeAttribute('loading');

        processImageNode(img, context);
        break;
      }

      case 'style': {
        // 替换 <link> 为 <style>
        if (node.tagName.toLowerCase() === 'link') {
          const style = document.createElement('style');
          style.textContent = this.data;
          node.replaceWith(style);
        } else if (node.tagName.toLowerCase() === 'style') {
          node.textContent = this.data;
        }
        break;
      }

      case 'script': {
        const script = node as HTMLScriptElement;
        // 清除外部引用，注入内联代码
        script.removeAttribute('src');
        script.textContent = this.data;
        // 注意：新注入的脚本不会自动执行！这是浏览器安全策略。
        // 如需执行，需手动创建新 script 并 append（但有风险，通常归档时不执行）
        break;
      }

      case 'font':
        // 字体通常在 CSS 中处理，此处一般不直接对应 DOM 节点
        // 所以 applyTo 可能不被调用
        break;

      case 'empty':
      case 'other':
        // 保留原样或做日志
        break;
    }
  }

  /**
   * 工厂方法：从处理器结果创建 Resource
   */
  static fromArchived(archived: ArchivedResource, originalNode: Element): Resource {
    return new Resource({
      type: archived.type as ResourceType,
      data: archived.data,
      originalUrl: (archived as any).url, // 可选扩展字段
      mimeType: (archived as any).mimeType,
      originalNode
    });
  }
}

/**
 * 辅助函数：从原始节点创建占位 Resource（用于未处理情况）
 */
export function createResourceFromNode(node: Element, archived: ArchivedResource): Resource {
  return Resource.fromArchived(archived, node);
}

/**
 * 处理图像节点，将其转换为使用CSS变量背景图的形式
 * @param node - HTML图像元素节点
 * @param context - 归档过程中的运行时上下文，包含资源图谱等信息
 * @param getPlaceholderDataURI - 获取占位图数据URI的方法
 */
function processImageNode(
  node: HTMLElement,
  context: ArchivingContext
): void {
  const img = node as HTMLImageElement;
  const archiverImageId = node.getAttribute(IMAGE_ATTRIBUTE_NAME);
  if (!archiverImageId) return;

  const cssVarName = `--archiver-image-${archiverImageId}`;
  const existingResource = context.graph.getImageResource(archiverImageId);

  if (!existingResource?.content) return;

  // 如果CSS变量不存在，则创建它
  if (context.graph.getCSSVariable(cssVarName) === undefined) {
    context.graph.setCSSVariable(`url(${existingResource.content})`, cssVarName);
  }

  // 统一处理：添加样式类、设置背景图、设置占位图
  applyImageStyles(img, cssVarName, existingResource);
}

/**
 * 应用图像样式和属性
 */
function applyImageStyles(
  img: HTMLImageElement,
  cssVarName: string,
  imageData: ArchivingImageData
): void {
  img.classList.add('sf-img');
  img.setAttribute('style', `background-image: var(${cssVarName})!important;`);
  img.setAttribute('src', getPlaceholderDataURI(imageData.size.width, imageData.size.height));
}
