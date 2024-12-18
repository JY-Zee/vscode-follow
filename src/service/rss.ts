import * as vscode from 'vscode';
import { FeedKeys, FOLLOW_FEEDS_LIST, FollowFeed } from '../constants';
import { parseXML } from '../tools/xmlTools';
import request, { requestRssData } from '../tools/serivce';

/**
 * 处理rss数据
 * @param feeds
 * @param data
 */
export const handleRSSData = async (feeds: FollowFeed, data: any): Promise<Article[]> => {
  switch (feeds.key) {
    case FeedKeys.CLS_TELEGRAPH:
      // 处理财联社数据
      const result = await handleClsTelegraphData(data);
      return result;
    case FeedKeys.ITHOME:
      // 处理IT之家数据
      const result2 = await handleITHomeData(data);
      return result2;
    case FeedKeys.V2EX:
      // 处理V2EX数据
      const result3 = await handleV2EXData(data);
      return result3;
    default:
      vscode.window.showErrorMessage(`未找到处理 ${feeds.key} 数据的方法`);
      return [];
  }
};

export interface ClsTelegraphEntry {
  title: string;
  link: string;
  published: string;
  content: string;
  id: string;
}

// 定义一个统一的文章接口
export interface Article {
  title: string;
  link: string;
  content: string;
  id: string;
  publishTime: string;
  v2ex_id?: string;
  author?: string;
  feedKey?: FeedKeys;
  comments?: Article[]; // 评论
}

export const handleITHomeData = async (xmlData: string): Promise<Article[]> => {
  try {
    const data = await parseXML(xmlData);

    // 检查数据格式
    if (!data?.rss?.channel?.[0]?.item) {
      throw new Error('数据格式不正确');
    }

    // 获取所有文章条目
    const items = data.rss.channel[0].item;

    // 转换为统一的 Article 格式
    const articles: Article[] = items.map((item: any) => ({
      title: item.title[0] || '',
      link: item.link[0] || '',
      content: item.description[0] || '',
      id: item.guid[0] || '',
      publishTime: new Date(item.pubDate[0]).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }));

    return articles;
  } catch (error) {
    vscode.window.showErrorMessage(
      `解析IT之家数据失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return [];
  }
};

export const handleClsTelegraphData = async (xmlData: string): Promise<Article[]> => {
  try {
    // 先将 XML 解析为 JSON
    const data = await parseXML(xmlData);

    // 后续解析逻辑保持不变
    if (!data?.feed?.entry) {
      throw new Error('数据格式不正确');
    }

    const entries = data.feed.entry;
    const result: Article[] = entries.map((entry: ClsTelegraphEntry) => ({
      title: Array.isArray(entry.title) ? entry.title[0] : entry.title || '',
      link: Array.isArray(entry.link) && entry.link[0]?.$ ? entry.link[0].$.href : '',
      content: Array.isArray(entry.content) && entry.content[0]?._ ? entry.content[0]._ : '',
      id: Array.isArray(entry.id) ? entry.id[0] : entry.id || '',
      publishTime: Array.isArray(entry.published)
        ? new Date(entry.published[0]).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : new Date(entry.published).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) || '',
    }));
    return result;
  } catch (error) {
    vscode.window.showErrorMessage(
      `解析财联社数据失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return [];
  }
};

export const handleV2EXData = async (xmlData: string): Promise<Article[]> => {
  try {
    // 解析 XML 数据
    const data = await parseXML(xmlData);

    // 检查数据格式
    if (!data?.feed?.entry) {
      throw new Error('V2EX数据格式不正确');
    }

    // 获取所有文章条目
    const entries = data.feed.entry;

    // 转换为统一的 Article 格式
    const articles: Article[] = entries.map((entry: any): Article => {
      const result: Article = {
        title: Array.isArray(entry.title) ? entry.title[0] : entry.title || '',
        link: Array.isArray(entry.link)
          ? entry.link.find((l: any) => l.$?.rel === 'alternate')?.$?.href || ''
          : entry.link?.$.href || '',
        content: Array.isArray(entry.content)
          ? entry.content[0]._ || entry.content[0] || ''
          : entry.content || '',
        id: Array.isArray(entry.id) ? entry.id[0] : entry.id || '',
        publishTime: Array.isArray(entry.published)
          ? new Date(entry.published[0]).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : new Date(entry.published).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }) || '',
      };

      // 从id中提取v2ex_id
      const v2ex_id = result.id.split('/').pop();
      result.v2ex_id = v2ex_id;

      result.feedKey = FeedKeys.V2EX;

      // 获取评论
      // const comments = await getV2EXComments(v2ex_id);
      // result.comments = comments;

      return result;
    });
    return articles;
  } catch (error) {
    console.log('error :>> ', error);
    vscode.window.showErrorMessage(
      `解析V2EX数据失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return [];
  }
};

export const getV2EXComments = async (v2ex_id: string | undefined): Promise<Article[]> => {
  if (!v2ex_id) {
    return [];
  }
  try {
    // 查找v2ex的feed
    const feed = FOLLOW_FEEDS_LIST.find((feed: FollowFeed) => feed.key === FeedKeys.V2EX);
    if (!feed?.commentFeeds) {
      throw new Error('未找到V2EX评论feed配置');
    }

    // 请求评论feed
    const response = await request.get(`${feed.commentFeeds}/${v2ex_id}`);

    // 解析XML数据
    const data = await parseXML(response);

    // 检查数据格式
    if (!data?.rss?.channel?.[0]?.item) {
      // 没有评论
      return [];
    }

    // 获取所有评论条目
    const items = data.rss.channel[0].item;
    // 转换为统一的 Article 格式
    const comments: Article[] = items.map((item: any) => ({
      title: item.title[0] || '',
      link: item.link[0] || '',
      content: item.description[0] || '',
      author: item.author[0] || '',
      // id: item.guid[0] || '',
      // publishTime: new Date(item.pubDate[0]).toLocaleString('zh-CN', {
      //   year: 'numeric',
      //   month: '2-digit',
      //   day: '2-digit',
      //   hour: '2-digit',
      //   minute: '2-digit',
      //   second: '2-digit',
      // })
    }));

    return comments;
  } catch (error) {
    vscode.window.showErrorMessage(
      `解析V2EX评论数据失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return [];
  }
};

export const handleComments = (comments: Article[]) => {};
