// src/utils/url.ts

/**
 * 将相对 URL 解析为绝对 URL
 * @param relativeUrl 可能是相对路径、绝对路径、协议相对路径等
 * @param baseUrl 基准 URL（通常是页面 URL 或 CSS 文件 URL）
 * @returns 绝对 URL 字符串
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    // 浏览器原生支持 URL 构造函数，可自动处理各种情况
    return new URL(relativeUrl, baseUrl).href;
  } catch (err) {
    // 如果解析失败（如无效 URL），原样返回（由调用方处理错误）
    console.warn(`[resolveUrl] Failed to resolve: ${relativeUrl} against ${baseUrl}`, err);
    return relativeUrl;
  }
}

/**
 * 根据 URL 的文件扩展名推测 MIME 类型
 * 仅覆盖常见静态资源类型（图片、字体、CSS、JS 等）
 * @param url 资源 URL
 * @returns MIME 类型字符串，如 'image/png'，无法识别时返回 undefined
 */
export function getMimeType(url: string): string | undefined {
  try {
    // 提取扩展名（忽略查询参数和哈希）
    const pathname = new URL(url, 'http://dummy').pathname.toLowerCase();
    const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

    // 常见扩展名映射表
    const mimeMap: Record<string, string> = {
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',

      // Fonts
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      otf: 'font/otf',
      eot: 'application/vnd.ms-fontobject',

      // Styles & Scripts
      css: 'text/css',
      js: 'application/javascript',
      mjs: 'application/javascript',
      json: 'application/json',

      // Others
      html: 'text/html',
      txt: 'text/plain',
      xml: 'application/xml'
    };

    return mimeMap[ext] || undefined;
  } catch (err) {
    // URL 无效时无法提取扩展名
    return undefined;
  }
}
