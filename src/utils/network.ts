// src/utils/network.ts

import type { ArchivingOptions } from '../models/options';

/**
 * 带超时和选项的 fetch 封装
 */
async function fetchWithTimeout(
  url: string,
  options: ArchivingOptions,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      // 在 content script 中，credentials 通常不需要
      credentials: 'omit',
      // 防止缓存干扰（可选）
      cache: 'no-store'
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * 获取文本内容（如 CSS、JS）
 */
export async function fetchText(url: string, options: ArchivingOptions): Promise<string> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/') || contentType.includes('javascript') || contentType.includes('json')) {
    return await res.text();
  }
  // 如果不是文本，尝试转为文本（比如某些服务器返回 application/octet-stream 但实际是 JS）
  const blob = await res.blob();
  return await blob.text();
}

/**
 * 获取二进制 Blob（如图片、字体）
 */
export async function fetchBlob(url: string, options: ArchivingOptions): Promise<Blob> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.blob();
}
