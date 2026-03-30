### 🔍 使用示例

```ts
// resolveUrl 示例
resolveUrl('style.css', 'https://example.com/page/') 
// → 'https://example.com/page/style.css'

resolveUrl('//cdn.com/a.css', 'https://example.com') 
// → 'https://cdn.com/a.css'

resolveUrl('/global.css', 'https://example.com/sub/page.html') 
// → 'https://example.com/global.css'

// getMimeType 示例
getMimeType('logo.png')           // → 'image/png'
getMimeType('font.woff2?v=1')     // → 'font/woff2'
getMimeType('script.js?ts=123')   // → 'application/javascript'
getMimeType('unknown.xyz')        // → undefined
```
