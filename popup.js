/**
 * Popup Script - 扩展弹窗的JavaScript逻辑
 *
 * Popup的特点：
 * - 只在用户点击扩展图标时运行
 * - 可以与content script通信
 * - 控制扩展的用户界面
 */

// 调试模式控制（与其他文件共享）
if (typeof window.MOSAIC_DEBUG === 'undefined') {
    window.MOSAIC_DEBUG = false;
}

// 调试日志函数
function debugLog(...args) {
    if (window.MOSAIC_DEBUG) {
        debugLog(...args);
    }
}

// 获取页面元素
const analyzeBtn = document.getElementById('analyzeBtn');
const solveBtn = document.getElementById('solveBtn');
const nextStepBtn = document.getElementById('nextStepBtn');
const resetBtn = document.getElementById('resetBtn');
const stepByStepMode = document.getElementById('stepByStepMode');
const statusDiv = document.getElementById('status');
const stepInfo = document.getElementById('stepInfo');
const stepText = document.getElementById('stepText');

// 工具函数：显示状态消息
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;  // success, error, info
    statusDiv.style.display = 'block';

    // 3秒后自动隐藏
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// 工具函数：显示步骤信息
function showStepInfo(message) {
    stepText.textContent = message;
    stepInfo.style.display = 'block';
}

// 工具函数：隐藏步骤信息
function hideStepInfo() {
    stepInfo.style.display = 'none';
}

// 工具函数：向当前标签页的content script发送消息
async function sendMessageToContentScript(message) {
    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        // 检查是否在目标网站
        if (!tab.url.includes('puzzle-minesweeper.com')) {
            showStatus('请先打开马赛克拼图网页！', 'error');
            return null;
        }

        // 向content script发送消息
        const response = await chrome.tabs.sendMessage(tab.id, message);
        return response;

    } catch (error) {
        console.error('发送消息失败:', error);
        showStatus('通信失败，请刷新网页后重试', 'error');
        return null;
    }
}

// 分析拼图按钮点击事件
analyzeBtn.addEventListener('click', async () => {
    debugLog('🔍 用户点击了分析拼图按钮');

    // 禁用按钮防止重复点击
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '🔄 分析中...';

    try {
        // 向content script发送分析请求
        const response = await sendMessageToContentScript({
            action: 'analyze'
        });

        if (response && response.success) {
            showStatus(response.message, 'success');
            debugLog('📊 拼图分析结果:', response.data);
        } else {
            showStatus('分析失败', 'error');
        }

    } catch (error) {
        console.error('分析拼图时出错:', error);
        showStatus('分析时发生错误', 'error');

    } finally {
        // 恢复按钮状态
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '🔍 分析拼图';
    }
});

// 求解拼图按钮点击事件
solveBtn.addEventListener('click', async () => {
    debugLog('🧠 用户点击了求解拼图按钮');

    const isStepByStep = stepByStepMode.checked;
    debugLog(`📋 选择的模式: ${isStepByStep ? '步骤演示' : '即时求解'}`);

    // 禁用按钮防止重复点击
    solveBtn.disabled = true;
    solveBtn.textContent = isStepByStep ? '🎬 演示中...' : '🧠 求解中...';

    try {
        // 向content script发送求解请求
        const response = await sendMessageToContentScript({
            action: 'solve_puzzle',
            stepByStep: isStepByStep
        });

        if (response && response.success) {
            showStatus(response.message, 'success');

            // 如果是步骤演示模式，显示下一步按钮和步骤信息
            if (isStepByStep) {
                nextStepBtn.style.display = 'block';
                solveBtn.textContent = '🎬 演示中...';
                showStepInfo('算法已准备就绪，点击"下一步"开始');
            } else {
                hideStepInfo();
            }
        } else {
            showStatus('求解失败', 'error');
        }

    } catch (error) {
        console.error('求解拼图时出错:', error);
        showStatus('求解时发生错误', 'error');

    } finally {
        // 根据模式设置恢复时间
        const restoreTime = isStepByStep ? 5000 : 3000;
        setTimeout(() => {
            solveBtn.disabled = false;
            solveBtn.textContent = '🧠 求解拼图';
        }, restoreTime);
    }
});

// 下一步按钮点击事件
nextStepBtn.addEventListener('click', async () => {
    debugLog('👉 用户点击了下一步按钮');

    try {
        // 向content script发送下一步请求
        const response = await sendMessageToContentScript({
            action: 'next_step'
        });

        if (response && response.success) {
            // 在步骤信息区域显示迭代信息，而不是在status中
            showStepInfo(response.message);

            // 如果算法完成，隐藏下一步按钮和步骤信息
            if (response.completed) {
                nextStepBtn.style.display = 'none';
                hideStepInfo();
                solveBtn.disabled = false;
                solveBtn.textContent = '🧠 求解拼图';
                showStatus('步骤演示完成！', 'success');
            }
        } else {
            showStatus('下一步失败', 'error');
            showStepInfo('执行失败，请重试');
        }

    } catch (error) {
        console.error('下一步时出错:', error);
        showStatus('下一步时发生错误', 'error');
    }
});

// 重置按钮点击事件
resetBtn.addEventListener('click', async () => {
    debugLog('🔄 用户点击了重置按钮');

    try {
        // 向content script发送重置请求
        const response = await sendMessageToContentScript({
            action: 'reset'
        });

        if (response && response.success) {
            showStatus('扩展已重置', 'success');

            // 重置UI状态
            nextStepBtn.style.display = 'none';
            hideStepInfo();
            solveBtn.disabled = false;
            solveBtn.textContent = '🧠 求解拼图';
        } else {
            showStatus('重置失败', 'error');
        }

    } catch (error) {
        console.error('重置时出错:', error);
        showStatus('重置时发生错误', 'error');
    }
});

// 加载保存的设置
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['stepByStepMode']);
        const savedMode = result.stepByStepMode || false; // 默认为即时求解模式
        stepByStepMode.checked = savedMode;
        debugLog(`📂 加载设置: 步骤演示模式 = ${savedMode}`);
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 保存设置
async function saveSettings() {
    try {
        await chrome.storage.sync.set({
            stepByStepMode: stepByStepMode.checked
        });
        debugLog(`💾 保存设置: 步骤演示模式 = ${stepByStepMode.checked}`);
    } catch (error) {
        console.error('保存设置失败:', error);
    }
}

// 页面加载完成时的初始化
document.addEventListener('DOMContentLoaded', async () => {
    debugLog('🚀 马赛克测试扩展popup已加载');

    // 加载保存的设置
    await loadSettings();

    // 监听设置变化
    stepByStepMode.addEventListener('change', () => {
        debugLog(`🔄 设置已更改: 步骤演示模式 = ${stepByStepMode.checked}`);
        saveSettings(); // 立即保存设置
    });

    // 检查当前是否在目标网站
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url.includes('puzzle-minesweeper.com')) {
            showStatus('已连接到马赛克拼图网站', 'success');
        } else {
            showStatus('请打开马赛克拼图网站', 'info');
        }
    });
});

// 错误处理：监听未捕获的错误
window.addEventListener('error', (event) => {
    console.error('Popup脚本错误:', event.error);
    showStatus('扩展发生错误', 'error');
});