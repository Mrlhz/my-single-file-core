// src/utils/dom.ts

import { DATA_ID_ATTRIBUTE_NAME, KEPT_TAG_NAMES, REMOVED_CONTENT_ATTRIBUTE_NAME } from './constants';

export function testHiddenElement(element: Element, computedStyle: CSSStyleDeclaration | null) {
	let hidden = false;
	if (computedStyle) {
		const display = computedStyle.getPropertyValue("display");
		const opacity = computedStyle.getPropertyValue("opacity");
		const visibility = computedStyle.getPropertyValue("visibility");
		hidden = display == "none";
		if (!hidden && (opacity == "0" || visibility == "hidden") && element.getBoundingClientRect) {
			const boundingRect = element.getBoundingClientRect();
			hidden = !boundingRect.width && !boundingRect.height;
		}
	}
	return Boolean(hidden);
}

/**
 * 查找并标记隐藏元素，供后续预处理器使用
 * @param doc 
 * @returns 
 */
export function findAndMarkHiddenElements(doc: Document): Element[] {
  const hiddenElements: Element[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
  
  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    const style = window.getComputedStyle(element);
    if (testHiddenElement(element, style)) {
      element.setAttribute(REMOVED_CONTENT_ATTRIBUTE_NAME, 'true');
      hiddenElements.push(element);
    }
  }
  
  return hiddenElements;
}

/**
 * 根据图片 URL 获取图片的实际尺寸
 * @param url 图片 URL
 * @returns Promise<{ width: number; height: number }>
 */
export function getImageSizeByUrl(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      reject(err);
    };
    img.src = url;
  });
}

/**
 * 获取图片大小（如果图片已经加载完成则直接返回，否则等待加载完成）
 * @param img HTMLImageElement
 * @returns Promise<{ width: number; height: number }>
 */
export function getImageSizeByElement(img: HTMLImageElement): Promise<{ width: number; height: number }> {
  if (img.complete) {
    return Promise.resolve({ width: img.naturalWidth, height: img.naturalHeight });
  }
  return new Promise((resolve, reject) => {
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

// 获取image 元素的src属性值，优先考虑懒加载属性
export function getImageSrc(img: HTMLImageElement): string | null {
  const LAZY_SRC_ATTRIBUTES = ['file', 'data-src', 'data-lazy-src', 'data-original', 'ng-src', 'data-srcset', 'data-lazy-srcset', 'data-original-srcset', 'ng-srcset', 'srcset', 'src'];
  for (const attr of LAZY_SRC_ATTRIBUTES) {
    const src = img.getAttribute(attr);
    if (src) {
      return src;
    }
  }
  return img.src || null;
}

// 获取占位图的 DataURI
export function getPlaceholderDataURI(width: number = 16, height: number = 16): string {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill-opacity="0"/></svg>`;
}

// 收集文档各类资源节点（如图片、视频、音频等），并为每个节点打上唯一 ID 以便后续处理器定位
export function collectResourceNodes(root: Document | HTMLElement): Element[] {
  const nodes: Element[] = [];
  const walker = document.createTreeWalker(
    root instanceof Document ? root.documentElement : root,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  let node: Element | null = null;
  while ((node = walker.nextNode() as Element | null)) {
    if (!node.hasAttribute(DATA_ID_ATTRIBUTE_NAME)) {
      node.setAttribute(DATA_ID_ATTRIBUTE_NAME, `${nodes.length}`);
    }
    nodes.push(node);
  }
  return nodes;
}

// 收集文档各类资源节点（如图片、视频、音频等），并为每个节点打上唯一 ID 以便后续处理器定位
// 标记隐藏元素，供预处理器使用
// 返回所有被标记为隐藏的元素列表，供预处理器使用
// 注意：这个函数会修改 DOM，为每个元素添加 data-archiver-id 属性，并为隐藏元素添加 data-archiver-removed 属性
// 预处理器可以通过查找 data-archiver-removed 属性来识别哪些元素被标记为隐藏，从而进行特殊处理（如移除、替换占位符等）
// 这个函数的设计使得整个归档流程更加模块化和可扩展，预处理器可以根据需要选择性地处理被标记为隐藏的元素，而不需要在每个处理器中重复判断元素是否隐藏
// 同时，这个函数也为后续的资源处理器提供了一个统一的标记机制，使得资源处理器可以更方便地定位和处理各类资源节点，无论它们是否被标记为隐藏
// 这个函数的执行时机是在预处理器之前，确保所有资源处理器都能基于同样的标记机制来处理节点，从而实现更一致和高效的资源处理流程
// 这个函数的返回值是被标记为隐藏的元素列表，供预处理器使用，预处理器可以根据需要对这些元素进行特殊处理（如移除、替换占位符等），从而实现更灵活和高效的归档策略
// 注意：这个函数会修改 DOM，为每个元素添加 data-archiver-id 属性，并为隐藏元素添加 data-archiver-removed 属性，预处理器可以通过查找 data-archiver-removed 属性来识别哪些元素被标记为隐藏，从而进行特殊处理（如移除、替换占位符等）
export function collectAndMarkResourceNodes(root: Document | HTMLElement): { nodes: Element[]; hiddenElements: Element[] } {
  const nodes: Element[] = [];
  const hiddenElements: Element[] = [];
  const walker = document.createTreeWalker(
    root instanceof Document ? root.documentElement : root,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  let node: Element | null = null;
  while ((node = walker.nextNode() as Element | null)) {
    if (!node.hasAttribute(DATA_ID_ATTRIBUTE_NAME)) {
      node.setAttribute(DATA_ID_ATTRIBUTE_NAME, `${nodes.length}`);
    }
    nodes.push(node);

    const style = window.getComputedStyle(node);
    const elementKept = (node.closest('html > head') && KEPT_TAG_NAMES.includes(node.tagName.toUpperCase()))
    if (!elementKept && testHiddenElement(node, style)) {
      node.setAttribute(REMOVED_CONTENT_ATTRIBUTE_NAME, 'true');
      hiddenElements.push(node);
    }
  }
  return { nodes, hiddenElements };
}

// 将 CSS 变量组合成style内容
export function joinCSSVariables(variables: Record<string, string>): string {
  const cssText = Object.entries(variables).map(([key, value]) => `${value}: ${key};`).join('\n');
  return `:root {\n${cssText}\n}`;
}

// 插入style元素到文档头部
export function insertStyleElement(root: Document | HTMLElement, cssText: string): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssText;
  (root instanceof Document ? root.head : root.querySelector('head'))?.appendChild(styleElement);
}
