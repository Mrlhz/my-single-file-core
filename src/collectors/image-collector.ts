
import { CollectProcessor, ArchivingContext, ArchivingImageData } from '@/core/types';
import { EMPTY_RESOURCE, IMAGE_ATTRIBUTE_NAME } from '../utils/constants';
import { getImageSizeByElement, getImageSrc, testHiddenElement } from '../utils/dom';
import { resolveUrl } from '@/utils/url';

export class ImageCollector implements CollectProcessor {
  match(node: Element): boolean {
    const tagName = node.tagName.toLowerCase();
    return tagName === 'img' || tagName === 'source' || (tagName === 'input' && (node as HTMLInputElement).type === 'image');
  }

  async process(node: Element, context: ArchivingContext): Promise<ArchivingImageData> {
    // 不直接处理图片资源，而是标记该节点以供 ImageProcessor 后续处理
    // 在 ImageProcessor 中统一处理 <picture>、<img> 和 <source> 的关系
    const existingIndex = node.getAttribute(IMAGE_ATTRIBUTE_NAME);
    const images = context.graph.getAllElementInfo().get('images');
    if (existingIndex !== null && Array.isArray(images) && images[Number(existingIndex)]) {
      // 已经被标记过了，避免重复处理
      return images[Number(existingIndex)];
    }

    const computedStyle = window.getComputedStyle(node);
    const elementHidden = testHiddenElement(node, computedStyle);
    const size = await getImageSizeByElement(node as HTMLImageElement);
    const currentSrc = getImageSrc(node as HTMLImageElement) || '';
    const imageData = {
      archiverId: '', // 后续会根据索引自动生成
      url: resolveUrl(currentSrc, context.pageUrl),
      content: '', // 这里不直接获取内容，交给 ImageProcessor 处理，避免重复请求和性能问题（其他处理器根据 URL 来获取和处理图片数据）
      currentSrc: elementHidden ? EMPTY_RESOURCE : currentSrc,
      size,
      boxShadow: computedStyle.getPropertyValue('box-shadow'),
      backgroundImage: computedStyle.getPropertyValue('background-image'),
      backgroundColor: computedStyle.getPropertyValue('background-color')
    }
    images.push(imageData);

    // 标记该节点，直接在节点上设置一个自定义属性来标记它，ImageProcessor 根据这个属性来识别和处理对应的图片数据
		node.setAttribute(IMAGE_ATTRIBUTE_NAME, String(images.length));
    imageData.archiverId = String(images.length); // 直接在数据对象上添加一个 id 字段，方便后续处理器使用
    // 将图片 URL 添加到批量请求中，供 ImageProcessor 处理
    context.bathRequest.addURL(imageData.url, { baseURI: context.pageUrl, contentType: 'image' });

    return imageData;
  }
}
