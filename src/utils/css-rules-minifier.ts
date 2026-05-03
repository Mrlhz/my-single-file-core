// src/utils/css-rules-minifier.ts

const csstree = (globalThis as any).csstree;

const cssRulesMinifier = {
  /**
   * 
   * @param cssText 
   * @param doc 
   */
  process(cssText: string, doc: Document): string {
    try {
      return removeUnusedCss({ rawCss: cssText, doc });
    } catch (error) {
      console.error('[cssRulesMinifier] Error occurred:', error);
      return removeUnusedCssByQuerySelector(cssText, doc);
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
// const optimizedCSS = cssRulesMinifier.process(originalCSS, document);

interface RemoveUnusedCssOptions {
  rawCss: string;
  domContext?: DOMSnapshot;
  doc: Document;
  whitelist?: {
    classes?: (string | RegExp)[];
    ids?: (string | RegExp)[];
    tags?: (string | RegExp)[];
  };
}
export function removeUnusedCss(options: RemoveUnusedCssOptions): string {
  const { rawCss, domContext, doc } = options;

  // 1. 获取 DOM 指纹
  const domSnapshot = domContext || getDOMSnapshot(doc);
  const usedClasses = new Set(domSnapshot.classes);
  const usedIds = new Set(domSnapshot.ids);
  const usedTags = new Set(domSnapshot.tags);

  // 2. 解析 CSS
  let ast: any;
  try {
    ast = csstree.parse(rawCss, {
      positions: false,
      parseRulePrelude: true, // 必须为 true，否则无法识别选择器细节
      parseValue: false // 大幅提升 MB 级别文件的速度
    });
  } catch (e) {
    console.error('[removeUnusedCss] Parse Error:', e);
    return rawCss;
  }

  // 3. 遍历并清理规则
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node: any, item: any, list: any) {
      if (node.prelude && node.prelude.type === 'SelectorList') {

        // 使用 forEach，回调的第二个参数是当前节点的包装对象 (data, next, prev)
        // 遍历选择器列表，例如 ".a, .b"
        node.prelude.children.forEach((selectorNode: any, selectorItem: any, selectorList: any) => {
          let isSelectorUsed = true;
          // 检查单个选择器中的所有原子（Class, ID, Tag）
          csstree.walk(selectorNode, (subNode: any) => {
            if (subNode.type === 'ClassSelector' && !usedClasses.has(subNode.name)) {
              if (!isWhitelisted(subNode.name, options.whitelist?.classes)) isSelectorUsed = false;
            } else if (subNode.type === 'IdSelector' && !usedIds.has(subNode.name)) {
              if (!isWhitelisted(subNode.name, options.whitelist?.ids)) isSelectorUsed = false;
            } else if (subNode.type === 'TypeSelector') {
              const tagName = subNode.name.toLowerCase();
              if (tagName !== '*' && !usedTags.has(tagName)) {
                if (!isWhitelisted(tagName, options.whitelist?.tags)) isSelectorUsed = false;
              }
            }
            // 注意：此处不处理 PseudoClass/Element，默认保留，以防误删
          });

          // 关键点：直接使用 selectorList.remove(selectorItem)
          // 这是 css-tree 官方标准的链表移除方式
          if (!isSelectorUsed) {
            selectorList.remove(selectorItem);
          }
        });

        // 如果该 Rule 下的所有选择器都被移除了，则移除整个 Rule
        // 检查是否全被删光了
        if (node?.prelude?.children?.isEmpty) {
          list.remove(item);
        }
      }
    }
  });


  // 4. 清理空容器（如空的 @media）
  csstree.walk(ast, {
    visit: 'Atrule',
    leave(node: any, item: any, list: any) {
      // 确保 isEmpty 后面没有括号
      if (node?.block?.children?.isEmpty) {
        list.remove(item);
      }
    }
  });

  // 5. 生成结果
  try {
    return csstree.generate(ast, { compress: true });
  } catch (e) {
    console.error('[removeUnusedCss] Generate Error:', e);
    return rawCss;
  }
}

function isWhitelisted(name: string, list?: (string | RegExp)[]): boolean {
  if (!list) return false;
  for (const item of list) {
    if (typeof item === 'string') {
      if (item === name) return true;
    } else if (item instanceof RegExp) {
      if (item.test(name)) return true;
    }
  }
  return false;
}


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

// 通过document.querySelector 进行HTML选择器验证的优化器
// 主要功能：移除未使用的CSS规则，减少最终CSS体积
// 实现思路：解析CSS为AST，遍历选择器并使用document.querySelector验证是否匹配当前页面的DOM，如果不匹配则移除该规则
// 注意事项：
// - 该优化器适用于归档过程中对CSS进行清洗和压缩，确保最终归档文件体积更小，加载更快
// - 需要提供当前页面的DOM上下文（Document对象）以进行选择器验证，如果无法提供则跳过优化
// - 该优化器会保守地保留无法解析或验证的选择器，以避免误删导致页面样式破坏

function removeUnusedCssByQuerySelector(cssText: string, doc: Document): string {
  if (typeof csstree === 'undefined') {
    console.log('[cssRulesMinifier]未检测到 CSSTree 库，请先注入 http://unpkg.com/csstree. CSS minification skipped.');
    return cssText;
  }
  if (!doc && typeof document !== 'undefined') {
    console.log('[cssRulesMinifier]未提供 document 对象，CSS 选择器优化可能不准确。');
    doc = document; // 回退到全局 document，虽然可能不适用于某些环境
  } else if (!doc) {
    console.log('[cssRulesMinifier]未提供 document 对象，且全局 document 不可用。CSS 选择器优化将被跳过。');
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
            console.log(`[cssRulesMinifier] 无法处理选择器 "${selector}"，保留原规则。`, e);
          }
        });
        // 这里可以添加更多的优化逻辑，例如：
        // - 移除未使用的 @keyframes 定义
        // - 合并重复的规则
        // - 压缩颜色值等
      }
    });

    // 4. 生成优化后的 CSS 文本
    return csstree.generate(ast, { compress: true });
  } catch (e) {
    console.error('[cssRulesMinifier]CSS minification error:', e);
    // 出现错误时返回原始 CSS，避免破坏页面样式
    return cssText;
  }
}
