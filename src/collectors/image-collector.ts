
import { CollectProcessor, ArchivingContext, ImageData } from '@/core/types';
import { EMPTY_RESOURCE, IMAGE_ATTRIBUTE_NAME } from '../utils/constants';
import { getImageSizeByElement, getImageSrc, testHiddenElement } from '../utils/dom';

export class ImageCollector implements CollectProcessor {
  match(node: Element): boolean {
    const tagName = node.tagName.toLowerCase();
    return tagName === 'img' || tagName === 'source' || (tagName === 'input' && (node as HTMLInputElement).type === 'image');
  }

  async process(node: Element, context: ArchivingContext): Promise<ImageData> {
    // 不直接处理图片资源，而是标记该节点以供 ImageProcessor 后续处理
    // 这样做的好处是可以在 ImageProcessor 中统一处理 <picture>、<img> 和 <source> 的关系
    const existingIndex = node.getAttribute(IMAGE_ATTRIBUTE_NAME);
    const images = context.graph.getAllElementInfo().get('images');
    if (existingIndex !== null && Array.isArray(images) && images[Number(existingIndex)]) {
      // 已经被标记过了，避免重复处理
      return images[Number(existingIndex)];
    }

    const computedStyle = window.getComputedStyle(node);
    const elementHidden = testHiddenElement(node, computedStyle);
    const size = await getImageSizeByElement(node as HTMLImageElement);
    const imageData = {
      currentSrc: elementHidden ? EMPTY_RESOURCE : getImageSrc(node as HTMLImageElement),
      size,
      boxShadow: computedStyle.getPropertyValue('box-shadow'),
      backgroundImage: computedStyle.getPropertyValue('background-image'),
      backgroundColor: computedStyle.getPropertyValue('background-color')
    }
    images.push(imageData);

    // 标记该节点，实际数据由 ImageProcessor 处理
    // 先设置索引，后续 ImageProcessor 会根据这个索引更新数据
    // 注意：这里我们直接在节点上设置一个自定义属性来标记它，这样 ImageProcessor 就可以识别并处理它了
		node.setAttribute(IMAGE_ATTRIBUTE_NAME, String(images.length));

    return imageData;
  }
}
