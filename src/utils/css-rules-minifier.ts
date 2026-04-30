// src/utils/css-rules-minifier.ts

const csstree = (globalThis as any).csstree;

const cssRulesMinifier = {
  /**
   * 执行优化
   * @param {string} cssText 原始CSS字符串
   * @param {Object} options 配置项
   */
  poocess(cssText: string, options: { removeUnused?: boolean, usedSelectors?: Set<string> } = {}): string {
    if (typeof csstree === 'undefined') {
      console.warn('[cssRulesMinifier]未检测到 CSSTree 库，请先注入 http://unpkg.com/csstree. CSS minification skipped.');
      return cssText;
    }
    try {
      // 1. 解析 CSS 文本为 AST
      const ast = csstree.parse(cssText, { parseValue: false, parseRulePrelude: false });

      // 2. 遍历 AST，移除不必要的规则和选择器
      csstree.walk(ast, {
        visit: 'Rule',
        enter(node: any) {
          if (node.type === 'Rule') {
            // 处理 @media 和 @supports 内部的规则
            if (node.prelude && (node.prelude.type === 'AtrulePrelude' || node.prelude.type === 'MediaQueryList')) {
              // 递归处理嵌套规则
              return;
            }

            // 3. 移除未使用的选择器（如果配置了 removeUnused）
            if (options.removeUnused && options.usedSelectors) {
              node.prelude.children = node.prelude.children.filter((selectorNode: any) => {
                const selectorStr = csstree.generate(selectorNode);
                const simplifiedSelector = simplifySelectorForQuery(selectorStr);
                return options.usedSelectors!.has(simplifiedSelector);
              });

              // 如果该规则没有任何选择器了，直接移除整个规则
              if (node.prelude.children.isEmpty()) {
                this.remove();
              }
            }
          }
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
