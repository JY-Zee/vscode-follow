import * as vscode from 'vscode';
import { FOLLOW_FEEDS_LIST, FollowFeed, FeedKeys } from './constants';
import { requestRssData } from './tools/serivce';
import { getV2EXComments, handleRSSData } from './service/rss';
import { Article } from './service/rss';
import { cleanHtmlContent } from './tools/xmlTools';

class FolderTreeItem extends vscode.TreeItem {
  constructor(
    public readonly option: FollowFeed,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: vscode.TreeItem[]
  ) {
    super(option.name, collapsibleState);
    // 添加刷新图标
    // this.iconPath = new vscode.ThemeIcon('refresh');
    // 添加 contextValue 以支持图标点击
    this.contextValue = this.option.key;
  }
}

class FollowViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private items: FolderTreeItem[] = [];
  private feedData: Map<FeedKeys, Article[]> = new Map();
  // 添加 OutputChannel
  private outputChannel: vscode.OutputChannel;
  private webviewPanel: vscode.WebviewPanel | undefined;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Follow Feed');
  }

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // 这个方法是 TreeDataProvider 接口必须实现的方法之一
  // 它接收一个 TreeItem 类型的参数，并返回同样的 TreeItem
  // 在这个简单的实现中，它直接返回传入的元素，不做任何修改
  // 这个方法的作用是让 VS Code 知道如何显示树视图中的每一个项目
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (element) {
      // 如果是 FolderTreeItem 类型，返回其子项
      if (element instanceof FolderTreeItem) {
        const feedItems = this.feedData.get(element.option.key) || [];
        return Promise.resolve(
          feedItems.map(item => {
            const treeItem = new vscode.TreeItem(
              `${item.publishTime} ${item.title}`,
              vscode.TreeItemCollapsibleState.None
            );
            // 为每个子项添加点击命令
            treeItem.command = {
              command: 'vscode-follow.clickFeedItemContent',
              title: 'Click Feed Item Content',
              arguments: [item],
            };
            return treeItem;
          })
        );
      }
      return Promise.resolve([]);
    }

    // 顶层项目
    const items = FOLLOW_FEEDS_LIST.map(
      feed => new FolderTreeItem(feed, vscode.TreeItemCollapsibleState.Collapsed)
    );
    // 保存所有的顶层项目
    this.items = items;
    return Promise.resolve(items);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // 添加更新数据的方法
  updateFeedData(key: FeedKeys, data: Article[]) {
    this.feedData.set(key, data);
    this.refresh();
  }

  // 添加收起所有项的命令
  collapseAll() {}
}

export function activate(context: vscode.ExtensionContext) {
  // 创建状态栏项目
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  statusBarItem.text = '$(sync) Follow';
  statusBarItem.tooltip = '点击开始跟随';
  statusBarItem.command = 'vscode-follow.toggleFollow';

  // 注册视图提供者
  const followViewProvider = new FollowViewProvider();

  // 'followView' 是一个视图的唯一标识符(ID),它需要与 package.json 中定义的 viewsContainers 和 views 配置相对应
  // 这个ID用于在VS Code的侧边栏中注册和显示我们的自定义树视图
  // followViewProvider 是我们实现的视图数据提供者,用于控制视图中显示的内容
  vscode.window.registerTreeDataProvider('followView', followViewProvider);

  // 注册命令
  let disposable = vscode.commands.registerCommand('vscode-follow.toggleFollow', () => {
    // 打开侧边栏视图
    vscode.commands.executeCommand('workbench.view.extension.follow-explorer');

    vscode.window.showInformationMessage('Follow 功能已切换！');
    followViewProvider.refresh(); // 刷新视图
  });

  // 注册点击 Feed 项的命令
  let clickFeedDisposable = vscode.commands.registerCommand(
    'vscode-follow.clickFeedItem',
    async (folderTreeItem: FolderTreeItem) => {
      const { option } = folderTreeItem;
      vscode.window.showInformationMessage(`点击了 ${option.name}`);
      const selectedFeed = FOLLOW_FEEDS_LIST.find(feed => feed.name === option.name);
      if (selectedFeed) {
        try {
          // 请求rss数据
          const rssData = await requestRssData(selectedFeed);
          // 处理rss数据
          const data = await handleRSSData(selectedFeed, rssData);
          // 更新视图数据
          followViewProvider.updateFeedData(selectedFeed.key, data);
        } catch (error) {
          vscode.window.showErrorMessage(
            `获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`
          );
        }
      }
    }
  );

  // 创建 OutputChannel
  const outputChannel = vscode.window.createOutputChannel('Follow Feed');

  // 注册点击文章内容的命令
  let clickFeedItemContentDisposable = vscode.commands.registerCommand(
    'vscode-follow.clickFeedItemContent',
    async (item: Article) => {
      outputChannel.clear();

      // 使用分隔线和空格来创建更好的视觉层次
      outputChannel.appendLine('='.repeat(50));
      outputChannel.appendLine(`\n${item.title}\n`);
      outputChannel.appendLine('='.repeat(50));

      // 添加元数据区块
      outputChannel.appendLine('\n📅 发布时间');
      outputChannel.appendLine(`   ${item.publishTime}`);

      outputChannel.appendLine('\n🔗 原文链接');
      outputChannel.appendLine(`   ${item.link}`);

      // 内容区块
      outputChannel.appendLine('\n📝 文章内容');
      outputChannel.appendLine('-'.repeat(50));

      // 处理内容中的 HTML 标签
      // 抽取HTML标签替换逻辑为公共函数

      const cleanContent = cleanHtmlContent(item.content);

      // 添加缩进使内容更易读
      const formattedContent = cleanContent
        .split('\n')
        .map(line => `   ${line}`)
        .join('\n');

      outputChannel.appendLine(formattedContent);
      outputChannel.appendLine('\n' + '='.repeat(50));

      // 添加评论区块
      if (item.feedKey === FeedKeys.V2EX) {
        // 查询评论
        const comments = await getV2EXComments(item.v2ex_id);
        outputChannel.appendLine('\n📝 评论');
        outputChannel.appendLine('-'.repeat(50));
        outputChannel.appendLine(
          comments
            ?.map(comment => `${comment.author}:\n${cleanHtmlContent(comment.content)}\n`)
            .join('\n') || ''
        );
      }
      outputChannel.show(true);
    }
  );
  // 注册收起所有项的命令
  //   let collapseAllDisposable = vscode.commands.registerCommand('vscode-follow.collapseAll', () => {
  //     followViewProvider.collapseAll();
  //   });
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(disposable);
  context.subscriptions.push(clickFeedDisposable);
  context.subscriptions.push(clickFeedItemContentDisposable);
  //   context.subscriptions.push(collapseAllDisposable);
}

export function deactivate() {}
