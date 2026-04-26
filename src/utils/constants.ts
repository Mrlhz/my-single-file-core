
const PREFIX = 'archiver';

export const DATA_ID_ATTRIBUTE_NAME = `data-${PREFIX}-id`;

export const IMAGE_ATTRIBUTE_NAME = `data-${PREFIX}-image`;
export const STYLE_ATTRIBUTE_NAME = `data-${PREFIX}-style`;
export const SCRIPT_ATTRIBUTE_NAME = `data-${PREFIX}-script`;
export const FONT_ATTRIBUTE_NAME = `data-${PREFIX}-font`;
export const EMPTY_ATTRIBUTE_NAME = `data-${PREFIX}-empty`;

export const REMOVED_CONTENT_ATTRIBUTE_NAME = `data-${PREFIX}-removed`;

export const EMPTY_RESOURCE = 'data:,';

// 保留某些标签，避免被错误地移除或修改，尤其是 NOSCRIPT 需要保留以确保内容完整性
export const KEPT_TAG_NAMES = ['NOSCRIPT', 'DISABLED-NOSCRIPT', 'META', 'LINK', 'STYLE', 'TITLE', 'TEMPLATE', 'SOURCE', 'OBJECT', 'SCRIPT', 'HEAD', 'BODY'];
