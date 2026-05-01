// src/utils/css-rules-minifier.ts

const csstree = (globalThis as any).csstree;

const cssRulesMinifier = {
  /**
   * 执行优化
   * @param {string} cssText 原始CSS字符串
   * @param {Object} options 配置项
   */
  process(cssText: string, domContext: DOMSnapshot, options: { doc?: Document } = {}): string {
    if (typeof csstree === 'undefined') {
      console.warn('[cssRulesMinifier]未检测到 CSSTree 库，请先注入 http://unpkg.com/csstree. CSS minification skipped.');
      return cssText;
    }
    let { doc } = options;
    if (!doc && typeof document !== 'undefined') {
      console.warn('[cssRulesMinifier]未提供 document 对象，CSS 选择器优化可能不准确。');
      doc = document; // 回退到全局 document，虽然可能不适用于某些环境
    } else if (!doc) {
      console.warn('[cssRulesMinifier]未提供 document 对象，且全局 document 不可用。CSS 选择器优化将被跳过。');
      return cssText; // 无法进行选择器优化，直接返回原始 CSS
    }
    try {
      // 1. 解析 CSS 文本为 AST
      const ast = csstree.parse(cssText, { parseValue: false, parseRulePrelude: false });

      // 2. 遍历 AST，移除不必要的规则和选择器
      csstree.walk(ast, {
        visit: 'Rule',
        enter(node: any, item: any, list: any) {
          // 遍历多重选择器
          const childrens = node.prelude?.children ? Array.from(node.prelude.children) : [node.prelude];
          childrens.forEach((selectorNode) => {
            const selector = csstree.generate(selectorNode);
            const simplifiedSelector = simplifySelectorForQuery(selector);
            if (simplifiedSelector === '') {
              // 如果简化后选择器为空，说明它完全由伪类/伪元素组成，保留它以避免误删
              return;
            }
            try {
              // 3. 使用 document.querySelector 检查选择器是否匹配当前页面的 DOM
              if (!doc.querySelector(simplifiedSelector)) {
                // 如果没有匹配的元素，说明这个选择器未被使用，可以从 AST 中移除
                list.remove(item);
              }
            } catch (e) {
              // 如果选择器无效（例如由于复杂的组合或语法错误），则保守地保留它
              console.warn(`[cssRulesMinifier] 无法处理选择器 "${selector}"，保留原规则。`, e);
            }
          });
        }
      });

      // 4. 生成优化后的 CSS 文本
      return csstree.generate(ast);
    } catch (e) {
      console.error('[cssRulesMinifier]CSS minification error:', e);
      // 出现错误时返回原始 CSS，避免破坏页面样式
      return cssText;
    }
  }
};

export default cssRulesMinifier;

// 使用示例：
// const originalCSS = `
//   .used-class { color: red; }
//   .unused-class { color: blue; }
//   .menu-item:hover > a::after { content: ''; }
// `;
// const domSnapshot = getDOMSnapshot(document);
// const minifiedCSS = cssRulesMinifier.process(originalCSS, domSnapshot, { doc: document });
// console.log(minifiedCSS);

/**
 * 提取当前页面的 DOM 指纹
 */
export interface DOMSnapshot {
  classes: string[];
  tags: string[];
  ids: string[];
}
export function getDOMSnapshot(doc: Document): DOMSnapshot {
  const snapshot = { classes: [], tags: [], ids: [] };
  const all = doc.querySelectorAll('*');
    
  all.forEach((el: Element) => {
    snapshot.tags.push(el.tagName.toLowerCase());
    if (el.id) {
      snapshot.ids.push(el.id);
    }
    el.classList.forEach(c => snapshot.classes.push(c));
  });
    
  return {
    classes: [...new Set(snapshot.classes)],
    tags: [...new Set(snapshot.tags)],
    ids: [...new Set(snapshot.ids)]
  };
}

/**
 * 将 CSS 选择器转换为浏览器可查询的 DOM 选择器
 * @param {string} selector - 原始选择器，如 ".menu-item:hover > a::after"
 * @returns {string} 剥离后的选择器，如 ".menu-item > a"
 */
function simplifySelectorForQuery(selector: string): string {
  return selector
    // 1. 移除伪元素 (双冒号开头的，如 ::after, ::placeholder)
    .replace(/::[\w-]+(\([^\)]+\))?/gi, '')
    
    // 2. 移除伪类 (单冒号开头的)
    // 需要注意排除属性选择器中的冒号（虽然很少见）以及保留 :not() 内部的内容（可选）
    // 这里采用保守策略：移除所有 : 开头直到单词边界或特殊符号的部分
    .replace(/:[\w-]+(\([^\)]+\))?/gi, '')
    
    // 3. 清理多余空格
    .replace(/\s+/g, ' ')
    .trim()
    
    // 4. 清理由于移除伪类/伪元素可能导致的末尾组合符残留
    // 例如 "div > :hover" 变成 "div > "，这会导致 querySelector 报错
    .replace(/\s*[>+~]\s*$/, '')
    .trim();
}
