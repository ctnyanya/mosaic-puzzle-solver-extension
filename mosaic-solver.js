/**
 * 马赛克拼图求解算法
 *
 * 算法原理：
 * - 每个数字(1-9)表示该位置周围8个邻居中需要填充的数量
 * - 使用约束传播逐步确定单元格状态
 * - 支持步骤演示和即时求解两种模式
 */

// 调试模式控制 - 开发者可以在F12控制台中切换
window.MOSAIC_DEBUG = false; // 默认关闭调试输出

// 安全机制：全局求解状态管理
const SolverSafetyManager = {
    startTime: null,
    maxTimeMs: 30000, // 30秒超时
    maxRecursionDepth: 100, // 最大递归深度
    maxIterations: 10000, // 最大迭代次数
    operationCount: 0,
    currentDepth: 0,
    isTimeoutExceeded: false,

    reset() {
        this.startTime = Date.now();
        this.operationCount = 0;
        this.currentDepth = 0;
        this.isTimeoutExceeded = false;
    },

    checkTimeout() {
        if (this.startTime && (Date.now() - this.startTime) > this.maxTimeMs) {
            this.isTimeoutExceeded = true;
            debugLog("⚠️ 求解超时，停止算法");
            return true;
        }
        return false;
    },

    incrementOperation() {
        this.operationCount++;
        if (this.operationCount > this.maxIterations) {
            debugLog("⚠️ 达到最大操作次数，停止算法");
            return true;
        }
        return false;
    },

    enterRecursion() {
        this.currentDepth++;
        if (this.currentDepth > this.maxRecursionDepth) {
            debugLog("⚠️ 递归深度过深，停止算法");
            return true;
        }
        return false;
    },

    exitRecursion() {
        this.currentDepth--;
    },

    shouldStop() {
        return this.isTimeoutExceeded || this.checkTimeout() || this.incrementOperation();
    }
};

// 将安全管理器暴露到全局以便其他模块访问
window.SolverSafetyManager = SolverSafetyManager;

// 调试日志函数
function debugLog(...args) {
    if (window.MOSAIC_DEBUG) {
        console.log(...args);
    }
}

// 供开发者在F12控制台使用的调试控制函数
window.enableMosaicDebug = () => {
    window.MOSAIC_DEBUG = true;
    console.log("🔧 马赛克调试模式已启用");
};

window.disableMosaicDebug = () => {
    window.MOSAIC_DEBUG = false;
    console.log("🔇 马赛克调试模式已关闭");
};

// 测试安全机制的开发者工具函数
window.testSafetyMechanisms = () => {
    console.log("🧪 测试安全机制...");

    // 重置安全管理器
    SolverSafetyManager.reset();
    console.log("✅ 安全管理器已重置");

    // 测试超时检查
    SolverSafetyManager.startTime = Date.now() - 31000; // 模拟31秒前开始
    console.log("⏰ 超时检查:", SolverSafetyManager.checkTimeout() ? "✅ 正常检测超时" : "❌ 超时检测失败");

    // 重置后测试操作计数
    SolverSafetyManager.reset();
    SolverSafetyManager.operationCount = 10001; // 超过限制
    console.log("🔢 操作计数检查:", SolverSafetyManager.incrementOperation() ? "✅ 正常检测操作超限" : "❌ 操作计数检测失败");

    // 重置后测试递归深度
    SolverSafetyManager.reset();
    SolverSafetyManager.currentDepth = 101; // 超过限制
    console.log("📊 递归深度检查:", SolverSafetyManager.enterRecursion() ? "✅ 正常检测递归超限" : "❌ 递归深度检测失败");

    // 最终重置
    SolverSafetyManager.reset();
    console.log("🎉 安全机制测试完成，管理器已重置");
};

// 马赛克拼图约束传播算法
// 输入: 2D数组，数字表示约束，null表示无约束
// 输出: 2D数组，1表示填充，0表示空白，-1表示未知
function solveMosaicAlgorithm(constraintGrid, stepByStep = false, puzzleData = null, progressCallback = null) {
    debugLog("🧠 执行约束传播算法...");
    debugLog("📐 输入网格大小:", constraintGrid.length, "x", constraintGrid[0].length);

    const rows = constraintGrid.length;
    const cols = constraintGrid[0].length;

    // 初始化解决方案网格 (-1=未知, 0=空白, 1=填充)
    let solution = Array(rows).fill().map(() => Array(cols).fill(-1));

    debugLog("🎯 马赛克拼图约束网格:");
    for (let r = 0; r < rows; r++) {
        const rowStr = constraintGrid[r].map(cell => cell === null ? '.' : cell).join(' ');
        debugLog(`   行${r}: ${rowStr}`);
    }

    if (stepByStep && puzzleData) {
        // 初始化步骤控制器（使用新的马赛克约束分析）
        stepSolverState = new MosaicStepController(solution, constraintGrid, puzzleData);
        debugLog("🎬 步骤演示模式已准备就绪，等待用户手动控制");
        return solution; // 返回初始解决方案
    } else {
        return mosaicConstraintPropagation(solution, constraintGrid, progressCallback);
    }
}

// 马赛克拼图约束分析：每个数字位置周围需要有指定数量的填充邻居
function analyzeConstraints(constraintGrid, solution) {
    const rows = constraintGrid.length;
    const cols = constraintGrid[0].length;
    let changed = false;

    // 分析每个有数字约束的位置
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (constraintGrid[r][c] !== null) {
                const requiredCount = constraintGrid[r][c];
                const result = analyzeNumberConstraint(r, c, requiredCount, solution);

                if (result.changed) {
                    changed = true;
                }
            }
        }
    }

    return changed;
}

// 分析单个数字约束
function analyzeNumberConstraint(row, col, requiredCount, solution) {
    // 获取3x3区域的所有位置（包括中心）
    const area3x3 = get3x3Area(row, col, solution.length, solution[0].length);
    const unknownCells = [];
    const filledCells = [];
    const emptyCells = [];

    // 统计3x3区域内的状态（包括中心格子）
    area3x3.forEach(([r, c]) => {
        const state = solution[r][c];
        if (state === -1) unknownCells.push([r, c]);
        else if (state === 1) filledCells.push([r, c]);
        else if (state === 0) emptyCells.push([r, c]);
    });

    let changed = false;
    const newCells = [];

    // 只在有变化时输出详细日志
    const hasAction = (filledCells.length === requiredCount && unknownCells.length > 0) ||
                     (filledCells.length + unknownCells.length === requiredCount && unknownCells.length > 0);

    if (hasAction) {
        debugLog(`🔍 分析位置(${row},${col})约束${requiredCount}: 3x3区域已填充${filledCells.length}, 未知${unknownCells.length}`);
    }

    // 策略1: 如果已填充数量等于要求数量，其余单元格都标记为空白
    if (filledCells.length === requiredCount) {
        if (unknownCells.length > 0) {
            debugLog(`   策略1: 标记${unknownCells.length}个单元格为空白`);
            unknownCells.forEach(([r, c]) => {
                solution[r][c] = 0;
                newCells.push([r, c, 0]);
                changed = true;
            });
        }
    }

    // 策略2: 如果已填充数量+未知数量等于要求数量，所有未知单元格都必须填充
    else if (filledCells.length + unknownCells.length === requiredCount) {
        if (unknownCells.length > 0) {
            debugLog(`   策略2: 填充${unknownCells.length}个未知单元格`);
            unknownCells.forEach(([r, c]) => {
                solution[r][c] = 1;
                newCells.push([r, c, 1]);
                changed = true;
            });
        }
    }

    // 策略3: 检查是否有矛盾
    else if (filledCells.length > requiredCount) {
        debugLog(`❌ 约束矛盾: 位置(${row},${col})要求3x3区域有${requiredCount}个填充，但已有${filledCells.length}个`);
    }

    return { changed, newCells };
}

// 获取3x3区域的所有位置（包括中心）
function get3x3Area(row, col, rows, cols) {
    const area = [];

    // 3x3区域的所有相对位置（包括中心[0,0]）
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],  [0, 0],  [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    directions.forEach(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
            area.push([newRow, newCol]);
        }
    });

    return area;
}



// 马赛克约束传播主函数（增强版，包含回溯搜索）
function mosaicConstraintPropagation(solution, constraintGrid, progressCallback = null) {
    debugLog("🧠 开始马赛克增强求解算法...");

    // 初始化安全管理器
    SolverSafetyManager.reset();
    debugLog(`🔒 安全限制: 超时${SolverSafetyManager.maxTimeMs/1000}秒, 最大递归${SolverSafetyManager.maxRecursionDepth}层, 最大操作${SolverSafetyManager.maxIterations}次`);

    // 计算总单元格数
    const totalCells = solution.length * solution[0].length;
    let currentProgress = 0;

    // 进度更新函数
    function updateProgress(currentSolution = null) {
        // 使用传入的解决方案或默认的solution
        const solutionToCheck = currentSolution || solution;
        const resolvedCells = solutionToCheck.flat().filter(cell => cell !== -1).length;
        currentProgress = Math.round((resolvedCells / totalCells) * 100);

        debugLog(`📊 进度更新: ${resolvedCells}/${totalCells} = ${currentProgress}%`);

        if (progressCallback) {
            progressCallback(currentProgress, resolvedCells, totalCells);
        }
    }

    // 首先尝试纯约束传播
    const basicSolution = basicConstraintPropagation(solution, constraintGrid, (currentSol) => updateProgress(currentSol));

    // 检查是否因安全限制而停止
    if (SolverSafetyManager.shouldStop()) {
        debugLog("⚠️ 约束传播因安全限制而停止");
        updateProgress(basicSolution);
        return basicSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    }

    // 更新进度
    updateProgress(basicSolution);

    // 检查是否完全求解
    if (isCompletelyResolved(basicSolution)) {
        debugLog("🎉 纯约束传播成功解决拼图！");
        if (progressCallback) {
            progressCallback(100, totalCells, totalCells);
        }
        return basicSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    }

    // 如果约束传播无法完全解决，使用回溯搜索
    debugLog("🔍 约束传播未能完全解决，启动回溯搜索...");
    const backtrackSolution = backtrackSolve(basicSolution, constraintGrid, (currentSol) => updateProgress(currentSol));

    if (backtrackSolution && !SolverSafetyManager.shouldStop()) {
        debugLog("🎉 回溯搜索成功解决拼图！");
        updateProgress(backtrackSolution); // 确保显示100%
        return backtrackSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    } else {
        const reason = SolverSafetyManager.isTimeoutExceeded ? "超时" : "无解或达到安全限制";
        debugLog(`❌ 回溯搜索停止: ${reason}`);
        updateProgress(backtrackSolution || basicSolution); // 最终进度更新
        return basicSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    }
}


// 基础约束传播（原来的逻辑）
function basicConstraintPropagation(solution, constraintGrid, progressCallback = null) {
    let iterationCount = 0;
    let changed = true;
    const workingSolution = solution.map(row => [...row]);

    while (changed && !SolverSafetyManager.shouldStop()) {
        iterationCount++;
        debugLog(`🔄 基础约束传播迭代 ${iterationCount}`);

        changed = analyzeConstraints(constraintGrid, workingSolution);

        // 更新进度
        if (progressCallback) {
            progressCallback(workingSolution);
        }

        if (!changed) {
            debugLog("🏁 基础约束传播收敛");
            break;
        }

        // 防止无限循环（已由安全管理器处理，但保留作为双重保护）
        if (iterationCount > 100) {
            debugLog("⚠️ 达到传播迭代上限，停止基础传播");
            break;
        }
    }

    if (SolverSafetyManager.shouldStop()) {
        debugLog(`⚠️ 基础约束传播因安全限制停止（迭代${iterationCount}次）`);
    } else {
        debugLog(`✅ 基础约束传播完成，共进行 ${iterationCount} 次迭代`);
    }
    return workingSolution;
}

// 检查解是否完全确定
function isCompletelyResolved(solution) {
    return solution.every(row => row.every(cell => cell !== -1));
}


// 回溯搜索算法
function backtrackSolve(solution, constraintGrid, progressCallback = null) {
    // 安全检查：检查是否应该停止
    if (SolverSafetyManager.shouldStop()) {
        debugLog("⚠️ 回溯搜索因安全限制而停止");
        return null;
    }

    // 安全检查：递归深度控制
    if (SolverSafetyManager.enterRecursion()) {
        debugLog("⚠️ 递归深度超限，返回");
        SolverSafetyManager.exitRecursion();
        return null;
    }

    // 创建工作副本
    const workingSolution = solution.map(row => [...row]);

    // 查找最佳的未确定单元格（优先选择受约束最多的）
    const unknownCell = findBestUnknownCell(workingSolution, constraintGrid);
    if (!unknownCell) {
        // 没有未知单元格，检查解是否有效
        const isValid = isValidSolution(workingSolution, constraintGrid);
        SolverSafetyManager.exitRecursion();
        return isValid ? workingSolution : null;
    }

    const [row, col] = unknownCell;
    debugLog(`🎯 回溯搜索尝试单元格 (${row}, ${col}) [深度: ${SolverSafetyManager.currentDepth}]`);

    // 智能选择值的尝试顺序
    const valueOrder = getSmartValueOrder(row, col, workingSolution, constraintGrid);

    for (const value of valueOrder) {
        // 再次检查安全限制
        if (SolverSafetyManager.shouldStop()) {
            debugLog("⚠️ 在值尝试循环中检测到安全限制");
            break;
        }

        debugLog(`   尝试值: ${value === 1 ? '填充' : '空白'}`);

        // 设置假设值
        workingSolution[row][col] = value;

        // 更新进度
        if (progressCallback) {
            progressCallback(workingSolution);
        }

        // 检查当前假设是否与约束冲突
        if (isConsistentWithConstraints(workingSolution, constraintGrid)) {
            // 应用约束传播
            const propagatedSolution = basicConstraintPropagation(workingSolution, constraintGrid, progressCallback);

            // 检查传播后是否仍然一致且未超时
            if (!SolverSafetyManager.shouldStop() && isConsistentWithConstraints(propagatedSolution, constraintGrid)) {
                // 递归求解
                const result = backtrackSolve(propagatedSolution, constraintGrid, progressCallback);
                if (result) {
                    SolverSafetyManager.exitRecursion();
                    return result;
                }
            }
        }

        // 回溯：撤销假设
        workingSolution[row][col] = -1;

        // 回溯时也更新进度
        if (progressCallback) {
            progressCallback(workingSolution);
        }
    }

    debugLog(`❌ 单元格 (${row}, ${col}) 的所有假设都失败 [深度: ${SolverSafetyManager.currentDepth}]`);
    SolverSafetyManager.exitRecursion();
    return null;
}

// 查找最佳的未确定单元格（智能选择策略）
function findBestUnknownCell(solution, constraintGrid) {
    const rows = solution.length;
    const cols = solution[0].length;
    let bestCell = null;
    let maxConstraints = -1;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (solution[r][c] === -1) {
                // 计算影响这个单元格的约束数量
                const constraintCount = countAffectingConstraints(r, c, constraintGrid);

                if (constraintCount > maxConstraints) {
                    maxConstraints = constraintCount;
                    bestCell = [r, c];
                }
            }
        }
    }

    return bestCell;
}

// 计算影响指定单元格的约束数量
function countAffectingConstraints(row, col, constraintGrid) {
    const rows = constraintGrid.length;
    const cols = constraintGrid[0].length;
    let count = 0;

    // 检查所有可能包含这个单元格的3x3区域
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
            if (constraintGrid[r][c] !== null) {
                count++;
            }
        }
    }

    return count;
}

// 智能选择值的尝试顺序
function getSmartValueOrder(row, col, solution, constraintGrid) {
    // 分析周围约束，预测哪个值更可能正确
    let fillScore = 0;
    let emptyScore = 0;

    // 检查影响这个单元格的所有约束
    for (let r = Math.max(0, row - 1); r <= Math.min(solution.length - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(solution[0].length - 1, col + 1); c++) {
            const requiredCount = constraintGrid[r][c];
            if (requiredCount !== null) {
                const area3x3 = get3x3Area(r, c, solution.length, solution[0].length);

                let filledCount = 0;
                let unknownCount = 0;

                area3x3.forEach(([ar, ac]) => {
                    if (ar === row && ac === col) return; // 跳过当前位置
                    const state = solution[ar][ac];
                    if (state === 1) filledCount++;
                    else if (state === -1) unknownCount++;
                });

                // 如果还需要更多填充，倾向于填充
                if (filledCount < requiredCount) {
                    fillScore += (requiredCount - filledCount);
                }

                // 如果已经足够，倾向于空白
                if (filledCount >= requiredCount) {
                    emptyScore += 2;
                }
            }
        }
    }

    // 根据评分决定尝试顺序
    if (fillScore > emptyScore) {
        debugLog(`   智能选择: 优先尝试填充 (评分: 填充=${fillScore}, 空白=${emptyScore})`);
        return [1, 0];
    } else {
        debugLog(`   智能选择: 优先尝试空白 (评分: 填充=${fillScore}, 空白=${emptyScore})`);
        return [0, 1];
    }
}

// 查找第一个未确定的单元格（简单策略，保留作为备用）
function findFirstUnknownCell(solution) {
    for (let r = 0; r < solution.length; r++) {
        for (let c = 0; c < solution[0].length; c++) {
            if (solution[r][c] === -1) {
                return [r, c];
            }
        }
    }
    return null;
}

// 检查解是否与所有约束一致
function isConsistentWithConstraints(solution, constraintGrid) {
    const rows = constraintGrid.length;
    const cols = constraintGrid[0].length;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (constraintGrid[r][c] !== null) {
                const requiredCount = constraintGrid[r][c];
                const area3x3 = get3x3Area(r, c, rows, cols);

                let filledCount = 0;
                let unknownCount = 0;

                area3x3.forEach(([ar, ac]) => {
                    const state = solution[ar][ac];
                    if (state === 1) filledCount++;
                    else if (state === -1) unknownCount++;
                });

                // 检查约束是否可能满足
                if (filledCount > requiredCount || // 已填充过多
                    filledCount + unknownCount < requiredCount) { // 即使全填也不够
                    return false;
                }
            }
        }
    }
    return true;
}

// 检查完整解是否有效
function isValidSolution(solution, constraintGrid) {
    const rows = constraintGrid.length;
    const cols = constraintGrid[0].length;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (constraintGrid[r][c] !== null) {
                const requiredCount = constraintGrid[r][c];
                const area3x3 = get3x3Area(r, c, rows, cols);

                const filledCount = area3x3.reduce((count, [ar, ac]) => {
                    return count + (solution[ar][ac] === 1 ? 1 : 0);
                }, 0);

                if (filledCount !== requiredCount) {
                    return false;
                }
            }
        }
    }
    return true;
}

// 新的马赛克步骤控制器
class MosaicStepController {
    constructor(solution, constraintGrid, puzzleData) {
        this.solution = solution;
        this.constraintGrid = constraintGrid;
        this.puzzleData = puzzleData;
        this.iterationCount = 0;
        this.isComplete = false;
    }

    async executeNextStep() {
        if (this.isComplete) {
            return { success: false, message: "求解已完成", completed: true };
        }

        this.iterationCount++;
        debugLog(`\n🔄 马赛克手动迭代 ${this.iterationCount}`);

        // 记录变化前的状态
        const beforeState = this.solution.map(row => [...row]);

        // 执行一轮约束分析
        const changed = analyzeConstraints(this.constraintGrid, this.solution);

        if (!changed) {
            debugLog("🏁 马赛克约束传播收敛，无法进一步推进");
            this.isComplete = true;
            return {
                success: true,
                message: "约束传播完成，无法进一步推进",
                completed: true
            };
        }

        // 找出本次迭代新确定的单元格
        const newCells = [];
        for (let r = 0; r < this.solution.length; r++) {
            for (let c = 0; c < this.solution[0].length; c++) {
                if (beforeState[r][c] === -1 && this.solution[r][c] !== -1) {
                    newCells.push([r, c]);
                }
            }
        }

        // 点击需要填充的单元格
        if (newCells.length > 0) {
            const cellsToClick = newCells.filter(([r, c]) => this.solution[r][c] === 1);

            if (cellsToClick.length > 0) {
                debugLog(`🖱️ 点击 ${cellsToClick.length} 个单元格:`, cellsToClick);
                clickCellsByCoordinates(cellsToClick, this.puzzleData, false);
            }
        }

        // 检查是否完全求解
        const isFullyComplete = this.solution.every(row => row.every(cell => cell !== -1));
        if (isFullyComplete) {
            debugLog("🎉 拼图完全求解！");
            this.isComplete = true;
            return {
                success: true,
                message: "拼图完全求解！",
                completed: true
            };
        }

        return {
            success: true,
            message: `迭代 ${this.iterationCount}: 确定了 ${newCells.length} 个单元格`,
            completed: false
        };
    }
}