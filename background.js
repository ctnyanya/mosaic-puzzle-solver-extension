/**
 * Background Script - 后台服务工作器
 *
 * Background Script的特点：
 * - 在扩展的整个生命周期中运行
 * - 可以监听浏览器事件
 * - 控制扩展的行为和状态
 */

console.log("🚀 马赛克拼图扩展后台脚本已启动");

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 只在页面完成加载时处理
    if (changeInfo.status === 'complete' && tab.url) {
        console.log("📄 检测到页面加载完成:", tab.url);

        // 检查是否是马赛克拼图网站
        if (tab.url.includes('puzzle-minesweeper.com')) {
            console.log("🎯 检测到马赛克拼图网站，准备自动弹出popup");

            // 自动打开popup
            openPopupForTab(tabId);
        }
    }
});

// 监听标签页激活事件（用户切换到已存在的马赛克拼图标签页）
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        if (tab.url && tab.url.includes('puzzle-minesweeper.com')) {
            console.log("🔄 切换到马赛克拼图标签页，准备自动弹出popup");
            openPopupForTab(activeInfo.tabId);
        }
    } catch (error) {
        console.error("获取标签页信息失败:", error);
    }
});

// 打开popup的函数
async function openPopupForTab(tabId) {
    try {
        // 延迟一下确保页面完全加载
        setTimeout(async () => {
            console.log("✨ 自动打开扩展popup");

            // 使用action API打开popup
            await chrome.action.openPopup();

            console.log("🎉 Popup已自动打开！");
        }, 1000); // 延迟1秒确保页面稳定

    } catch (error) {
        console.error("自动打开popup失败:", error);
        console.log("💡 提示：某些情况下Chrome不允许程序自动打开popup");
    }
}

// 扩展启动时的初始化
chrome.runtime.onStartup.addListener(() => {
    console.log("🔧 扩展启动，初始化后台脚本");
});

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
    console.log("📦 扩展安装/更新，原因:", details.reason);

    if (details.reason === 'install') {
        console.log("🎊 首次安装马赛克拼图扩展！");
    } else if (details.reason === 'update') {
        console.log("🔄 扩展已更新到新版本");
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📨 收到来自content script的消息:", message);

    if (message.action === 'page_ready') {
        console.log("🎯 马赛克拼图页面已准备就绪，自动弹出popup");

        // 稍微延迟一下确保content script完全准备好
        setTimeout(() => {
            openPopupForTab(sender.tab.id);
        }, 500);

        sendResponse({ success: true });
    }
});

// 错误处理
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            console.error("连接断开错误:", chrome.runtime.lastError);
        }
    });
});