/**
 * Content Script - 注入到马赛克拼图网页中的脚本
 *
 * Content Script的特点：
 * - 运行在网页的环境中，可以访问和修改DOM
 * - 可以与扩展的其他部分通信
 * - 有一定的权限限制，比原生网页脚本安全
 */

// 调试模式控制（与mosaic-solver.js共享）
if (typeof window.MOSAIC_DEBUG === 'undefined') {
    window.MOSAIC_DEBUG = false;
}

// 调试日志函数
function debugLog(...args) {
    if (window.MOSAIC_DEBUG) {
        console.log(...args);
    }
}

console.log("🎯 马赛克拼图扩展已加载！");

// 全局变量：保存步骤演示的状态
let stepSolverState = null;

// 旧的控制器类已移至 mosaic-solver.js

// 设置机器人标识 - 让网站知道我们是自动求解器
function setRobotFlag() {
    console.log("🤖 设置机器人标识...");

    const robotField = document.getElementById('robot');
    if (robotField) {
        robotField.value = '1';
        console.log("✅ 已设置机器人标识为1");
        console.log("🏆 现在我们将进入机器人名人堂！");
        console.log("📜 作者消息:", robotField.getAttribute('data-info'));
    } else {
        console.log("❌ 未找到机器人标识字段");
    }
}

// 工具函数：查找所有拼图单元格
function findPuzzleCells() {
    // 根据之前分析的DOM结构，查找所有单元格
    const cells = document.querySelectorAll('.cell.selectable');
    console.log(`📋 找到 ${cells.length} 个拼图单元格`);
    return cells;
}

// 工具函数：分析单元格状态
function analyzeCellState(cell) {
    // 获取单元格的CSS类名来判断状态
    const className = cell.className;

    let state = 'empty';  // 默认为空白
    if (className.includes('cell-on')) {
        state = 'filled';   // 已填充黑色
    } else if (className.includes('cell-x')) {
        state = 'marked';   // 标记为不填充
    }

    // 获取数字提示（如果有）
    const numberElement = cell.querySelector('.number');
    const number = numberElement ? numberElement.textContent.trim() : '';

    // 获取位置信息
    const style = cell.getAttribute('style');
    const topMatch = style.match(/top:\s*(\d+)px/);
    const leftMatch = style.match(/left:\s*(\d+)px/);

    const position = {
        top: topMatch ? parseInt(topMatch[1]) : 0,
        left: leftMatch ? parseInt(leftMatch[1]) : 0
    };

    // 计算网格坐标 (基于像素位置)
    const row = Math.floor((position.top - 3) / 31);  // 31px间距
    const col = Math.floor((position.left - 3) / 31);

    return {
        state: state,
        number: number || null,
        position: position,
        row: row,
        col: col,
        element: cell
    };
}

// 工具函数：点击单元格 (增强版)
function clickCell(cell) {
    console.log(`🖱️ 点击单元格 (${cell.row}, ${cell.col}), 当前状态: ${cell.state}`);

    const element = cell.element;

    // 尝试多种点击方式，因为网站可能有特殊的事件处理

    // 方式1: 直接click()
    console.log("   尝试方式1: element.click()");
    element.click();

    // 方式2: 模拟鼠标事件
    setTimeout(() => {
        console.log("   尝试方式2: 鼠标事件");

        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // 创建鼠标事件
        const mouseEvents = ['mousedown', 'mouseup', 'click'];

        mouseEvents.forEach(eventType => {
            const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0  // 左键
            });
            element.dispatchEvent(event);
        });
    }, 200);

    // 方式3: 尝试触发焦点和键盘事件
    setTimeout(() => {
        console.log("   尝试方式3: 焦点事件");
        element.focus();

        // 模拟空格键或回车键
        const keyEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true
        });
        element.dispatchEvent(keyEvent);
    }, 400);

    // 等待状态更新并检查结果
    setTimeout(() => {
        const newState = analyzeCellState(element);
        console.log(`   最终状态: ${newState.state}`);

        if (newState.state !== cell.state) {
            console.log("   ✅ 单元格状态已改变！");
        } else {
            console.log("   ❌ 单元格状态未改变");
            console.log("   💡 可能需要检查网站的事件处理机制");
        }
    }, 600);
}

// 主要功能：分析整个拼图
function analyzePuzzle() {
    console.log("🔍 开始分析拼图...");

    const cells = findPuzzleCells();
    const puzzleData = [];

    // 分析每个单元格
    cells.forEach(cell => {
        const cellData = analyzeCellState(cell);
        puzzleData.push(cellData);
    });

    // 统计信息
    const stats = {
        total: puzzleData.length,
        empty: puzzleData.filter(c => c.state === 'empty').length,
        filled: puzzleData.filter(c => c.state === 'filled').length,
        marked: puzzleData.filter(c => c.state === 'marked').length,
        withNumbers: puzzleData.filter(c => c.number).length
    };

    console.log("📊 拼图分析结果:", stats);

    // 显示一些数字约束示例
    const numberedCells = puzzleData.filter(c => c.number).slice(0, 5);
    console.log("🔢 数字约束示例:", numberedCells.map(c =>
        `(${c.row},${c.col}): ${c.number}`
    ));

    return puzzleData;
}

// 测试功能：随机点击几个空白单元格
function testRandomClicks() {
    console.log("🎲 测试随机点击功能...");

    const puzzleData = analyzePuzzle();
    const emptyCells = puzzleData.filter(c => c.state === 'empty');

    if (emptyCells.length === 0) {
        console.log("❌ 没有找到空白单元格");
        return;
    }

    // 随机选择5个空白单元格进行点击测试
    const testCells = emptyCells.sort(() => Math.random() - 0.5).slice(0, 5);

    console.log(`🧪 准备同时点击 ${testCells.length} 个单元格...`);

    // 同时点击所有选中的单元格
    testCells.forEach((cell, index) => {
        console.log(`🎯 同时点击单元格 ${index + 1}: (${cell.row}, ${cell.col})`);
        clickCell(cell);
    });

    console.log("✅ 所有点击命令已发出！");
}

// 新增：批量点击函数 - 用于求解算法
function clickMultipleCells(cells) {
    console.log(`🔥 批量点击 ${cells.length} 个单元格...`);

    cells.forEach((cell, index) => {
        console.log(`   点击 ${index + 1}/${cells.length}: (${cell.row}, ${cell.col}) 状态: ${cell.state}`);
        clickCell(cell);
    });

    console.log("🎯 批量点击完成！");
}

// 算法相关代码已移至 mosaic-solver.js

// 旧的Nonogram算法代码已移除，现在使用 mosaic-solver.js 中的马赛克算法

// 从DOM数据转换为算法输入格式
function convertToConstraintGrid(puzzleData) {
    if (puzzleData.length === 0) return null;

    const maxRow = Math.max(...puzzleData.map(c => c.row));
    const maxCol = Math.max(...puzzleData.map(c => c.col));

    // 创建约束网格
    const constraintGrid = Array(maxRow + 1).fill().map(() =>
        Array(maxCol + 1).fill(null)
    );

    // 填充数字约束
    puzzleData.forEach(cell => {
        if (cell.number) {
            const number = parseInt(cell.number);
            if (!isNaN(number)) {
                constraintGrid[cell.row][cell.col] = number;
            }
        }
    });

    return constraintGrid;
}

// 从解决方案转换为点击坐标
function convertSolutionToClicks(solution, puzzleData) {
    const clickCoordinates = [];

    // 创建DOM元素映射
    const cellMap = {};
    puzzleData.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        cellMap[key] = cell;
    });

    // 遍历解决方案，找出需要点击的单元格
    for (let row = 0; row < solution.length; row++) {
        for (let col = 0; col < solution[row].length; col++) {
            if (solution[row][col] === 1) {
                const key = `${row},${col}`;
                const cell = cellMap[key];
                if (cell && cell.state === 'empty') {
                    clickCoordinates.push([row, col]);
                }
            }
        }
    }

    return clickCoordinates;
}

// 根据坐标数组点击单元格
function clickCellsByCoordinates(coordinates, puzzleData, stepByStep = false) {
    console.log(`🖱️ 准备点击 ${coordinates.length} 个单元格...`);

    // 创建DOM元素映射
    const cellMap = {};
    puzzleData.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        cellMap[key] = cell;
    });

    // 获取要点击的单元格对象
    const cellsToClick = coordinates.map(([row, col]) => {
        const key = `${row},${col}`;
        return cellMap[key];
    }).filter(cell => cell !== undefined);

    console.log(`🎯 找到 ${cellsToClick.length} 个有效单元格`);

    // 执行点击
    if (stepByStep) {
        executeClicksWithDelay(cellsToClick);
    } else {
        executeClicksInstantly(cellsToClick);
    }
}

// 主要的求解函数 - 整合所有步骤
async function solveMosaicPuzzle(stepByStep = false) {
    console.log("🧠 开始求解马赛克拼图...");
    console.log(`📋 模式: ${stepByStep ? '步骤演示' : '即时求解'}`);

    // 1. 获取拼图数据
    const puzzleData = analyzePuzzle();
    if (puzzleData.length === 0) {
        debugLog("❌ 无法获取拼图数据");
        return false;
    }

    // 2. 转换为算法输入格式
    const constraintGrid = convertToConstraintGrid(puzzleData);
    if (!constraintGrid) {
        console.log("❌ 转换约束网格失败");
        return false;
    }

    // 3. 执行求解算法
    let solution;
    if (stepByStep) {
        // 步骤演示模式：在算法内部直接执行点击
        solution = await solveMosaicAlgorithm(constraintGrid, true, puzzleData);
        console.log("🎬 步骤演示完成！");
        return true; // 直接返回，不需要额外点击
    } else {
        // 即时求解模式：算法完成后一次性点击
        solution = solveMosaicAlgorithm(constraintGrid, false, null);

        // 4. 转换解决方案为点击坐标
        const clickCoordinates = convertSolutionToClicks(solution, puzzleData);

        console.log(`🎲 生成了 ${clickCoordinates.length} 个点击坐标`);

        // 5. 执行点击
        clickCellsByCoordinates(clickCoordinates, puzzleData, false);

        return clickCoordinates.length > 0;
    }
}

// 获取邻居单元格
function getNeighbors(grid, row, col) {
    const neighbors = [];
    const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];

    directions.forEach(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < grid.length && newCol >= 0 && newCol < grid[0].length) {
            neighbors.push(grid[newRow][newCol]);
        }
    });

    return neighbors;
}

// 即时执行所有点击
function executeClicksInstantly(cells) {
    console.log("⚡ 即时执行所有点击...");
    clickMultipleCells(cells);
    console.log("✅ 即时点击完成！");
}

// 带延时的点击演示
function executeClicksWithDelay(cells) {
    console.log("🎬 开始点击演示...");

    cells.forEach((cell, index) => {
        setTimeout(() => {
            console.log(`📍 步骤 ${index + 1}/${cells.length}: 点击 (${cell.row}, ${cell.col})`);
            clickCell(cell);

            if (index === cells.length - 1) {
                console.log("🎉 点击演示完成！");
            }
        }, index * 1000); // 每秒执行一步
    });
}

// 新增：调试单元格事件监听器
function debugCellEvents(cell) {
    console.log("🔍 调试单元格事件监听器...");

    const element = cell.element;

    // 检查所有事件监听器
    const events = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'focus'];

    events.forEach(eventType => {
        element.addEventListener(eventType, (e) => {
            console.log(`   🎯 检测到 ${eventType} 事件:`, e);
        }, { once: true, capture: true });
    });

    // 检查是否有jQuery事件
    const jQueryEvents = element._events || $(element).data('events');
    if (jQueryEvents) {
        console.log("   📚 jQuery事件:", jQueryEvents);
    }

    // 尝试手动触发原生click事件
    setTimeout(() => {
        console.log("   🔥 尝试手动触发原生事件...");
        element.click();
    }, 1000);
}

// 新增：高级点击测试
function advancedClickTest() {
    console.log("🧪 高级点击测试开始...");

    const puzzleData = analyzePuzzle();
    const emptyCells = puzzleData.filter(c => c.state === 'empty').slice(0, 1);

    if (emptyCells.length === 0) {
        console.log("❌ 没有找到空白单元格");
        return;
    }

    const testCell = emptyCells[0];
    console.log(`🎯 选择测试单元格: (${testCell.row}, ${testCell.col})`);

    // 调试事件监听器
    debugCellEvents(testCell);

    // 尝试直接调用可能的JavaScript函数
    setTimeout(() => {
        console.log("🔍 尝试查找游戏对象...");

        // 检查全局游戏对象
        if (window.Game) {
            console.log("   找到全局Game对象:", window.Game);
        }

        // 检查jQuery对象
        if (window.$ && $('#game').length > 0) {
            console.log("   找到游戏容器jQuery对象");

            // 尝试触发jQuery事件
            $(testCell.element).trigger('click');
            console.log("   已触发jQuery click事件");
        }

        // 检查是否有特殊的游戏函数
        ['cellClick', 'toggleCell', 'selectCell'].forEach(funcName => {
            if (window[funcName]) {
                console.log(`   找到全局函数: ${funcName}`);
            }
        });

        // 新增：检查网站内部的JavaScript代码
        console.log("🔍 检查网站内部代码...");

        // 尝试查找所有可能的全局变量
        const gameRelatedVars = Object.keys(window).filter(key =>
            key.toLowerCase().includes('game') ||
            key.toLowerCase().includes('puzzle') ||
            key.toLowerCase().includes('mosaic') ||
            key.toLowerCase().includes('cell')
        );

        if (gameRelatedVars.length > 0) {
            console.log("   找到相关全局变量:", gameRelatedVars);
            gameRelatedVars.forEach(varName => {
                console.log(`   ${varName}:`, window[varName]);
            });
        }

        // 尝试直接修改DOM元素的class
        console.log("🎯 尝试直接修改DOM...");
        const originalClass = testCell.element.className;
        console.log(`   原始class: ${originalClass}`);

        // 尝试切换到填充状态
        if (originalClass.includes('cell-off')) {
            testCell.element.className = originalClass.replace('cell-off', 'cell-on');
            console.log("   已尝试切换到 cell-on 状态");

            // 检查是否成功
            setTimeout(() => {
                const newClass = testCell.element.className;
                console.log(`   修改后class: ${newClass}`);
                if (newClass !== originalClass) {
                    console.log("   ✅ DOM修改成功！");
                } else {
                    console.log("   ❌ DOM修改被覆盖，可能有JavaScript在监控");
                    // 恢复原始状态
                    testCell.element.className = originalClass;
                }
            }, 1000);
        }

    }, 2000);
}

// 重置扩展状态
function resetExtensionState() {
    stepSolverState = null;

    // 清理控制台（如果可能）
    if (typeof console.clear === 'function') {
        console.clear();
    }

    debugLog("🔄 扩展状态已重置");
}

// 重置拼图网格 - 将所有单元格恢复到空白状态
function resetPuzzleGrid() {
    debugLog("🔄 开始重置拼图网格...");

    const puzzleData = analyzePuzzle();
    if (puzzleData.length === 0) {
        debugLog("❌ 无法获取拼图数据");
        return false;
    }

    // 找到所有非空白的单元格（包括已填充和标记的）
    const nonEmptyCells = puzzleData.filter(cell => cell.state !== 'empty');

    if (nonEmptyCells.length === 0) {
        debugLog("✅ 拼图已经是空白状态");
        return true;
    }

    debugLog(`🎯 找到 ${nonEmptyCells.length} 个非空白单元格，准备重置`);

    // 瞬时重置所有非空白单元格
    nonEmptyCells.forEach((cell) => {
        debugLog(`   重置单元格 (${cell.row}, ${cell.col}) 当前状态: ${cell.state}`);

        // 根据单元格状态决定点击次数
        const clickCount = cell.state === 'filled' ? 1 : cell.state === 'marked' ? 2 : 1;

        // 连续点击重置单元格状态
        for (let i = 0; i < clickCount; i++) {
            clickCell(cell);
        }
    });

    debugLog("🎉 拼图网格重置完成");
    return true;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📨 收到消息:", message);

    // 添加错误处理
    try {

    switch(message.action) {
        case 'analyze':
            // 分析拼图并返回结果
            const puzzleData = analyzePuzzle();
            sendResponse({
                success: true,
                data: puzzleData,
                message: `分析完成！找到 ${puzzleData.length} 个单元格`
            });
            break;

        case 'solve_puzzle':
            // 求解拼图
            const stepByStep = message.stepByStep || false;

            // 使用异步处理
            solveMosaicPuzzle(stepByStep).then(success => {
                sendResponse({
                    success: success,
                    message: success ?
                        (stepByStep ? "开始步骤演示求解..." : "开始即时求解...") :
                        "求解失败，请检查拼图状态"
                });
            }).catch(error => {
                console.error("求解拼图时出错:", error);
                sendResponse({
                    success: false,
                    message: "求解过程中发生错误"
                });
            });

            // 立即发送初始响应，异步结果会在Promise中处理
            sendResponse({
                success: true,
                message: stepByStep ? "正在开始步骤演示..." : "正在开始即时求解..."
            });
            break;

        case 'next_step':
            // 执行下一步
            if (stepSolverState && stepSolverState.executeNextStep) {
                stepSolverState.executeNextStep().then(result => {
                    sendResponse(result);

                    // 如果完成，清空状态
                    if (result.completed) {
                        stepSolverState = null;
                    }
                }).catch(error => {
                    console.error("执行下一步时出错:", error);
                    sendResponse({
                        success: false,
                        message: "执行下一步时发生错误",
                        completed: true
                    });
                    stepSolverState = null;
                });
            } else {
                sendResponse({
                    success: false,
                    message: "没有活动的步骤演示会话",
                    completed: true
                });
            }
            break;

        case 'reset':
            // 重置扩展状态和拼图网格
            resetExtensionState();
            const gridResetSuccess = resetPuzzleGrid();

            sendResponse({
                success: true,
                message: gridResetSuccess ?
                    "扩展状态和拼图网格已重置" :
                    "扩展状态已重置，拼图网格重置可能失败"
            });
            break;

        default:
            sendResponse({
                success: false,
                message: "未知的操作"
            });
    }

    } catch (error) {
        console.error("处理消息时发生错误:", error);
        resetExtensionState(); // 重置状态

        sendResponse({
            success: false,
            message: "处理请求时发生错误，请重试"
        });
    }

    // 返回true表示会异步发送响应
    return true;
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("📄 页面加载完成，扩展已准备就绪");
    setRobotFlag(); // 立即设置机器人标识

    // 延迟一下确保页面完全加载
    setTimeout(() => {
        console.log("🎯 检查是否需要自动求解...");
        // 可以在这里添加自动求解逻辑
        // solveMosaicPuzzle(false); // 取消注释以启用自动求解
    }, 2000);
});

// 通知background script页面已准备好
function notifyPageReady() {
    console.log("📡 通知后台脚本：马赛克拼图页面已准备就绪");
    try {
        chrome.runtime.sendMessage({
            action: 'page_ready',
            url: window.location.href
        });
    } catch (error) {
        console.log("通知后台脚本失败（这是正常的）:", error.message);
    }
}

// 如果页面已经加载完成，立即执行初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("📄 页面加载完成，扩展已准备就绪");
        setRobotFlag(); // 立即设置机器人标识
        notifyPageReady(); // 通知后台脚本
    });
} else {
    console.log("📄 页面已加载，扩展已准备就绪");
    setRobotFlag(); // 立即设置机器人标识
    notifyPageReady(); // 通知后台脚本
}