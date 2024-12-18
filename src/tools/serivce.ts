import axios from 'axios';
import * as vscode from 'vscode';
import type { FollowFeed } from '../constants';

// 创建 axios 实例
const request = axios.create({
    timeout: 10000, // 超时时间
    headers: {
        'Content-Type': 'application/json',
    }
});

// 请求拦截器
request.interceptors.request.use(
    config => {
        // 这里可以添加loading状态
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 响应拦截器
request.interceptors.response.use(
    response => {
        return response.data;
    },
    error => {
        // 处理错误
        vscode.window.showErrorMessage(`请求失败: ${error.message}`);
        return Promise.reject(error);
    }
);

// RSS数据请求
export async function requestRssData(feed: FollowFeed) {
    try {
        // 显示进度条
        const progress = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `正在获取 ${feed.name} 的数据...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            const response = await request.get(feed.feeds);
            
            progress.report({ increment: 100 });
            return response;
        });

        return progress;
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`获取RSS数据失败: ${error.message}`);
        }
        throw error;
    }
}

// 可以添加更多的API请求方法
export async function otherApiRequest(params: any) {
    try {
        return await request.post('/api/endpoint', params);
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`请求失败: ${error.message}`);
        }
        throw error;
    }
}

export default request;
