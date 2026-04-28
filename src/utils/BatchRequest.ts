// src/utils/BatchRequest.ts

/**
 * 类型定义
 */
export interface ResourceResult {
  url: string;
  content: string | null; // Data URI string or null if failed
}

interface RequestCallbacks {
  resolve: (value: ResourceResult) => void;
  reject: (reason?: any) => void;
}

export type ProgressCallback = (loaded: number, total: number) => void;
export type OnLoadListener = (url: string, options?: any) => Promise<void> | void;

/**
 * 批量请求工具类
 * 用于批量处理资源请求，控制并发数量，收集结果等
 */

export class BatchRequest {
  private requests: Map<string, RequestCallbacks[]>; // Key 是请求的唯一标识，Value 是对应的 Promise
  private cancelled = false; // 用于标记是否取消了请求
  constructor() {
		this.requests = new Map();
  }

  addURL(requestKey: string): Promise<ResourceResult> {
    const { promise, resolve, reject } = Promise.withResolvers<ResourceResult>();
    let resourceRequests = this.requests.get(requestKey)
    if (!resourceRequests) {
      resourceRequests = [];
      this.requests.set(requestKey, resourceRequests);
    }
    const callbacks = { resolve, reject };
    resourceRequests.push(callbacks);
    return promise;
  }

  async runAll(onloadListener?: OnLoadListener, options?: any): Promise<ResourceResult[]> {
    const resourceURLs = Array.from(this.requests.keys());
    const total = resourceURLs.length;
    let completed = 0;
    const results: ResourceResult[] = [];

    const tasks = resourceURLs.map(async url => {
			const resourceRequests = this.requests.get(url) || [];
      try {
        const content = await fetchToDataUri(url, (loaded, total) => {
          console.log(`下载进度: ${url} - ${((loaded / total) * 100).toFixed(2)}%`);
        });
        if (typeof onloadListener === 'function') {
          await onloadListener(url, options);
        }
        results.push({ url, content });
        if (!this.cancelled) {
          resourceRequests.forEach(({ resolve }) => resolve({ url, content }));
        }
      } catch (error) {
        if (typeof onloadListener === 'function') {
          await onloadListener(url, options);
        }
        if (!this.cancelled) {
          resourceRequests.forEach(({ reject }) => reject(error));
        }
      } finally {
        this.requests.delete(url);
        completed++;
        if (completed === total) {
          console.log('所有资源请求已完成');
        }
      }
    });

    await Promise.all(tasks);
    console.log('所有资源请求已完成', results);

    return results;
  }

  cancel() {
    this.cancelled = true;
    this.requests.forEach((callbacks, url) => {
      callbacks.forEach(({ reject }) => reject(new Error('请求已取消')));
    });
    this.requests.clear();
  }

  getAllResults(): Promise<any[]> {
    return Promise.all(this.requests.values());
  }
}

/**
 * 下载资源并转换为 Data URI (Base64)
 * @param {string} url - 资源地址 (图片/字体等)
 * @param {function} onProgress - 进度回调 (loaded, total)
 * @returns {Promise<string>} - 返回 Base64 字符串 (如 "data:image/png;base64,...")
 */
async function fetchToDataUri(url: string, onProgress: (loaded: number, total: number) => void): Promise<string | null> {
  try {
    // 1. 发起请求
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    // 2. 获取总大小用于计算进度
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    // 3. 处理流以监控进度
    const reader = response?.body?.getReader();
    const stream = new ReadableStream({
      start(controller) {
        function push() {
          reader?.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            loaded += value.length;
            // 汇报进度
            if (onProgress) onProgress(loaded, total);
            controller.enqueue(value);
            push();
          });
        }
        push();
      }
    });

    // 4. 将流重新组合成 Blob
    // 注意：这里不能用 response.blob()，因为流已经被我们拦截了
    const newResponse = new Response(stream);
    const blob = await newResponse.blob();

    // 5. 将 Blob 转换为 Data URI
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  } catch (error) {
    console.log('转换 Data URI 失败:', error);
  }
  return null;
}
