import { REMOVED_CONTENT_ATTRIBUTE_NAME } from './constants';

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
