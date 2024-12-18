export interface FollowFeed {
  feeds: string;
  name: string;
  key: FeedKeys;
  commentFeeds?: string; // 评论feed
}

export enum FeedKeys {
  CLS_TELEGRAPH = 'cls-telegraph',
  ITHOME = 'ithome',
  V2EX = 'v2ex',
}

/**
 * 跟随的feed列表
 */
export const FOLLOW_FEEDS_LIST: FollowFeed[] = [
  {
    feeds: 'https://feeds.crabpi.com/cls-telegraph',
    name: '财联社-电报',
    key: FeedKeys.CLS_TELEGRAPH,
  },
  {
    feeds: 'https://www.ithome.com/rss/',
    name: 'IT之家',
    key: FeedKeys.ITHOME,
  },
  {
    feeds: 'https://www.v2ex.com/index.xml',
    name: 'V2EX',
    key: FeedKeys.V2EX,
    commentFeeds: 'https://rss.lilydjwg.me/v2ex',
  },
];
