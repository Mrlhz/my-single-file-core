// src/utils/style.ts

/**
 * 将 CSS 选择器转换为浏览器可查询的 DOM 选择器
 * @param {string} selector - 原始选择器，如 ".menu-item:hover > a::after"
 * @returns {string} 剥离后的选择器，如 ".menu-item > a"
 */
function simplifySelectorForQuery(selector: string): string {
  // 1. 移除伪类和伪元素（:hover、::after 等）
  let simplified = selector.replace(/:(?:hover|active|focus|visited|link|before|after|first-child|last-child|nth-child\(\d+\)|nth-of-type\(\d+\)|not\([^)]+\))/g, '');
  
  // 2. 移除属性选择器中的值（如 [type="text"] -> [type]）
  simplified = simplified.replace(/\[([^\]=]+)=["'][^"']*["']\]/g, '[$1]');
  
  // 3. 移除多余的空格
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  return simplified;
}
