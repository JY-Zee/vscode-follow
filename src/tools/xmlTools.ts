import { parseString } from 'xml2js';

// 将 XML 转换为 JSON 的 Promise 包装函数
export const parseXML = (xml: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

// 清理HTML内容
export const cleanHtmlContent = (content: string): string => {
  return content
    .replace(/<br\s*\/?>/gi, '\n') // 将 <br> 转换为换行
    .replace(/<p.*?>/gi, '\n') // 将 <p> 转换为换行
    .replace(/<\/p>/gi, '') // 移除 </p>
    .replace(/<(?:.|\n)*?>/gm, '') // 移除其他 HTML 标签
    .replace(/&nbsp;/g, ' ') // 替换 HTML 实体
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n\s*\n\s*\n/g, '\n\n'); // 移除多余的空行
};