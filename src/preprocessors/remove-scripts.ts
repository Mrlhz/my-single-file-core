import type { IDocPreprocessor, ArchivingContext } from '../core/types';

/**
 * 移除脚本
 */
export class RemoveScriptsPreprocessor implements IDocPreprocessor {
  process(doc: Document, context: ArchivingContext): void {
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // 移除事件处理器属性 (onclick, onerror 等)
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        if (attrs[i].name.startsWith('on')) {
          el.removeAttribute(attrs[i].name);
        }
      }
    });
  }
}
