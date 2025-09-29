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

// ==================== 新增：CSP架构 ====================

/**
 * CSP变量类 - 表示网格中的每个单元格
 */
class CSPVariable {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.domain = new Set([0, 1]); // 只有0=空白, 1=填充（不包含-1）
        this.value = -1; // 当前赋值，-1表示未赋值
        this.constraints = new Set(); // 影响此变量的约束
    }

    assign(value) {
        if (!this.domain.has(value)) {
            return false;
        }
        this.value = value;
        this.domain = new Set([value]); // 赋值后域只包含该值
        return true;
    }

    removeFromDomain(value) {
        return this.domain.delete(value);
    }

    isAssigned() {
        return this.value !== -1;
    }

    getDomainSize() {
        return this.domain.size;
    }
}

/**
 * CSP约束类 - 表示一个数字约束
 */
class CSPConstraint {
    constructor(centerRow, centerCol, requiredCount) {
        this.centerRow = centerRow;
        this.centerCol = centerCol;
        this.requiredCount = requiredCount;
        this.variables = new Set(); // 受此约束影响的变量
        this.id = `C_${centerRow}_${centerCol}`;
    }

    addVariable(variable) {
        this.variables.add(variable);
        variable.constraints.add(this);
    }

    // 检查当前约束是否满足
    isSatisfied() {
        let filledCount = 0;
        let unknownCount = 0;

        for (const variable of this.variables) {
            if (variable.value === 1) {
                filledCount++;
            } else if (variable.value === -1) {
                unknownCount++;
            }
            // variable.value === 0 是空白，不计数
        }

        // 检查是否违反约束
        if (filledCount > this.requiredCount) {
            debugLog(`   🚫 约束违反: 位置(${this.centerRow},${this.centerCol}) 要求${this.requiredCount}，已有${filledCount}个填充`);
            return false; // 过多填充
        }

        if (filledCount + unknownCount < this.requiredCount) {
            debugLog(`   🚫 约束违反: 位置(${this.centerRow},${this.centerCol}) 要求${this.requiredCount}，最多只能有${filledCount + unknownCount}个`);
            return false; // 即使全填也不够
        }

        return true;
    }

    // 获取与此约束相关的弧（变量对）
    getArcs() {
        const arcs = [];
        const varArray = Array.from(this.variables);

        for (let i = 0; i < varArray.length; i++) {
            for (let j = i + 1; j < varArray.length; j++) {
                arcs.push([varArray[i], varArray[j], this]);
                arcs.push([varArray[j], varArray[i], this]);
            }
        }
        return arcs;
    }
}

/**
 * CSP问题类 - 管理整个约束满足问题
 */
class MosaicCSP {
    constructor(constraintGrid) {
        this.rows = constraintGrid.length;
        this.cols = constraintGrid[0].length;
        this.variables = new Map(); // (row,col) -> CSPVariable
        this.constraints = new Map(); // id -> CSPConstraint

        // 初始化变量
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const variable = new CSPVariable(r, c);
                this.variables.set(`${r},${c}`, variable);
            }
        }

        // 初始化约束
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (constraintGrid[r][c] !== null) {
                    const constraint = new CSPConstraint(r, c, constraintGrid[r][c]);
                    this.constraints.set(constraint.id, constraint);

                    // 添加3x3区域内的变量到约束
                    const area3x3 = get3x3Area(r, c, this.rows, this.cols);
                    for (const [ar, ac] of area3x3) {
                        const variable = this.variables.get(`${ar},${ac}`);
                        constraint.addVariable(variable);
                    }
                }
            }
        }
    }

    getVariable(row, col) {
        return this.variables.get(`${row},${col}`);
    }

    getAllArcs() {
        const allArcs = [];
        for (const constraint of this.constraints.values()) {
            allArcs.push(...constraint.getArcs());
        }
        return allArcs;
    }

    isComplete() {
        for (const variable of this.variables.values()) {
            if (!variable.isAssigned()) {
                return false;
            }
        }
        return true;
    }

    isConsistent() {
        for (const constraint of this.constraints.values()) {
            if (!constraint.isSatisfied()) {
                return false;
            }
        }
        return true;
    }

    // 获取最受约束的变量（MRV启发式）
    getMostConstrainedVariable() {
        let bestVar = null;
        let minDomainSize = Infinity;
        let maxConstraints = -1;

        for (const variable of this.variables.values()) {
            if (!variable.isAssigned()) {
                const domainSize = variable.getDomainSize();
                const constraintCount = variable.constraints.size;

                if (domainSize < minDomainSize ||
                    (domainSize === minDomainSize && constraintCount > maxConstraints)) {
                    bestVar = variable;
                    minDomainSize = domainSize;
                    maxConstraints = constraintCount;
                }
            }
        }
        return bestVar;
    }

    // 转换为解决方案数组
    toSolutionArray() {
        const solution = Array(this.rows).fill().map(() => Array(this.cols).fill(-1));
        for (const variable of this.variables.values()) {
            solution[variable.row][variable.col] = variable.value;
        }
        return solution;
    }
}

/**
 * AC-3 弧一致性算法实现
 */
function ac3Algorithm(csp) {
    debugLog("🔄 开始AC-3弧一致性算法...");

    // 初始化队列，包含所有弧
    const queue = csp.getAllArcs();
    debugLog(`📊 初始弧数量: ${queue.length}`);

    let iterationCount = 0;
    const maxIterations = 1000; // 防止无限循环

    while (queue.length > 0 && iterationCount < maxIterations) {
        if (SolverSafetyManager.shouldStop()) {
            debugLog("⚠️ AC-3因安全限制而停止");
            break;
        }

        iterationCount++;
        const [xi, xj, constraint] = queue.shift();

        // 检查弧(xi, xj)是否一致
        if (revise(xi, xj, constraint)) {
            debugLog(`🔧 修订了变量(${xi.row},${xi.col})的域，当前域大小: ${xi.getDomainSize()}`);

            // 如果xi的域为空，则不一致
            if (xi.getDomainSize() === 0) {
                debugLog(`❌ 变量(${xi.row},${xi.col})域为空，问题不一致`);
                return false;
            }

            // 将所有与xi相关的弧（除了刚处理的）加入队列
            for (const neighborConstraint of xi.constraints) {
                for (const xk of neighborConstraint.variables) {
                    if (xk !== xi && xk !== xj) {
                        queue.push([xk, xi, neighborConstraint]);
                    }
                }
            }
        }
    }

    debugLog(`✅ AC-3完成，迭代${iterationCount}次`);
    return iterationCount < maxIterations;
}

/**
 * 修订函数 - AC-3算法的核心
 */
function revise(xi, xj, constraint) {
    let revised = false;
    const xiDomainCopy = new Set(xi.domain);

    debugLog(`🔧 修订弧 (${xi.row},${xi.col}) -> (${xj.row},${xj.col}) 在约束 ${constraint.id}`);
    debugLog(`   xi域: [${Array.from(xi.domain).join(',')}], xj域: [${Array.from(xj.domain).join(',')}]`);

    for (const value of xiDomainCopy) {
        if (xi.isAssigned() && xi.value !== value) {
            continue; // 已赋值的变量跳过其他值
        }

        if (!existsConsistentValue(xi, value, xj, constraint)) {
            xi.removeFromDomain(value);
            revised = true;
            debugLog(`   🗑️ 从变量(${xi.row},${xi.col})域中移除值${value}，剩余域: [${Array.from(xi.domain).join(',')}]`);
        }
    }

    return revised;
}

/**
 * 检查是否存在与xi=value一致的xj值
 */
function existsConsistentValue(xi, xiValue, xj, constraint) {
    for (const xjValue of xj.domain) {
        if (isConsistentAssignment(xi, xiValue, xj, xjValue, constraint)) {
            return true;
        }
    }
    return false;
}

/**
 * 检查两个变量的赋值是否与约束一致
 */
function isConsistentAssignment(xi, xiValue, xj, xjValue, constraint) {
    // 保存所有相关变量的原始值
    const originalValues = new Map();
    for (const variable of constraint.variables) {
        originalValues.set(variable, variable.value);
    }

    // 临时赋值
    xi.value = xiValue;
    xj.value = xjValue;

    // 检查约束是否满足
    const satisfied = constraint.isSatisfied();

    // 恢复所有原值
    for (const [variable, originalValue] of originalValues) {
        variable.value = originalValue;
    }

    return satisfied;
}

/**
 * MAC回溯搜索算法（维持弧一致性）
 */
function macBacktrackSearch(csp, progressCallback = null) {
    debugLog("🔍 开始MAC回溯搜索...");

    // 首先运行AC-3预处理
    if (!ac3Algorithm(csp)) {
        debugLog("❌ AC-3预处理发现问题不一致");
        return null;
    }

    // 开始回溯搜索
    return macBacktrack(csp, progressCallback);
}

/**
 * MAC回溯的递归实现
 */
function macBacktrack(csp, progressCallback = null) {
    // 安全检查
    if (SolverSafetyManager.shouldStop()) {
        debugLog("⚠️ MAC回溯因安全限制而停止");
        return null;
    }

    if (SolverSafetyManager.enterRecursion()) {
        debugLog("⚠️ MAC递归深度超限");
        SolverSafetyManager.exitRecursion();
        return null;
    }

    // 更新进度
    if (progressCallback) {
        progressCallback(csp.toSolutionArray());
    }

    // 检查是否完成
    if (csp.isComplete()) {
        debugLog("🎉 MAC找到完整解决方案！");
        SolverSafetyManager.exitRecursion();
        return csp.toSolutionArray();
    }

    // 选择变量（MRV + 度启发式）
    const variable = csp.getMostConstrainedVariable();
    if (!variable) {
        debugLog("❌ 无法找到未赋值变量");
        SolverSafetyManager.exitRecursion();
        return null;
    }

    debugLog(`🎯 选择变量(${variable.row},${variable.col})，域大小: ${variable.getDomainSize()}`);

    // 尝试域中的每个值（LCV启发式 - 最少约束值优先）
    const values = getOrderedValues(variable, csp);

    for (const value of values) {
        if (SolverSafetyManager.shouldStop()) {
            break;
        }

        debugLog(`   🔬 尝试值: ${value} [深度: ${SolverSafetyManager.currentDepth}]`);

        // 保存当前状态
        const savedState = saveCSPState(csp);

        // 赋值
        if (variable.assign(value)) {
            // 运行AC-3维持弧一致性
            if (ac3Algorithm(csp)) {
                // 递归搜索
                const result = macBacktrack(csp, progressCallback);
                if (result) {
                    SolverSafetyManager.exitRecursion();
                    return result;
                }
            } else {
                debugLog(`   ❌ 赋值${value}导致不一致`);
            }
        }

        // 回溯：恢复状态
        restoreCSPState(csp, savedState);
        debugLog(`   🔙 回溯，恢复变量(${variable.row},${variable.col})状态`);
    }

    debugLog(`❌ 变量(${variable.row},${variable.col})的所有值都失败`);
    SolverSafetyManager.exitRecursion();
    return null;
}

/**
 * 获取有序的值列表（LCV启发式）
 */
function getOrderedValues(variable, csp) {
    const values = Array.from(variable.domain);

    // 简单排序：优先尝试0（空白），然后1（填充）
    // 实际的LCV需要计算每个值对其他变量域的影响
    return values.sort((a, b) => {
        if (a === 0 && b === 1) return -1; // 空白优先
        if (a === 1 && b === 0) return 1;
        return 0;
    });
}

/**
 * 保存CSP状态
 */
function saveCSPState(csp) {
    const state = new Map();
    for (const [key, variable] of csp.variables) {
        state.set(key, {
            value: variable.value,
            domain: new Set(variable.domain)
        });
    }
    return state;
}

/**
 * 恢复CSP状态
 */
function restoreCSPState(csp, state) {
    for (const [key, savedVar] of state) {
        const variable = csp.variables.get(key);
        variable.value = savedVar.value;
        variable.domain = new Set(savedVar.domain);
    }
}

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

// 测试新CSP算法的开发者工具函数
window.testCSPAlgorithm = () => {
    console.log("🧪 测试CSP算法...");

    // 创建一个极简的测试拼图
    const testGrid = [
        [1, null],
        [null, 1]
    ];

    console.log("📋 简化测试用例:");
    testGrid.forEach((row, i) => {
        const rowStr = row.map(cell => cell === null ? '.' : cell).join(' ');
        console.log(`   行${i}: ${rowStr}`);
    });

    // 开启调试模式
    const originalDebug = window.MOSAIC_DEBUG;
    window.MOSAIC_DEBUG = true;

    try {
        // 创建CSP测试
        console.log("🏗️ 创建CSP结构...");
        const csp = new MosaicCSP(testGrid);
        console.log(`📊 变量数: ${csp.variables.size}, 约束数: ${csp.constraints.size}`);

        // 打印约束详情
        for (const constraint of csp.constraints.values()) {
            console.log(`🎯 约束${constraint.id}: 要求${constraint.requiredCount}个填充，影响${constraint.variables.size}个变量`);
        }

        // 测试AC-3
        console.log("🔄 测试AC-3...");
        const ac3Result = ac3Algorithm(csp);
        console.log("AC-3结果:", ac3Result ? "✅ 成功" : "❌ 失败");

        if (ac3Result) {
            // 显示域缩减结果
            for (const [key, variable] of csp.variables) {
                console.log(`变量(${variable.row},${variable.col}): 域[${Array.from(variable.domain).join(',')}]`);
            }
        }

    } catch (error) {
        console.error("❌ 测试失败:", error);
        console.error(error.stack);
    } finally {
        // 恢复调试设置
        window.MOSAIC_DEBUG = originalDebug;
    }
};

// 马赛克拼图约束传播算法（重构版 - 使用CSP和AC-3）
// 输入: 2D数组，数字表示约束，null表示无约束
// 输出: 2D数组，1表示填充，0表示空白，-1表示未知
function solveMosaicAlgorithm(constraintGrid, stepByStep = false, puzzleData = null, progressCallback = null) {
    debugLog("🧠 执行新的CSP约束传播算法...");
    debugLog("📐 输入网格大小:", constraintGrid.length, "x", constraintGrid[0].length);

    // 初始化安全管理器
    SolverSafetyManager.reset();
    debugLog(`🔒 安全限制: 超时${SolverSafetyManager.maxTimeMs/1000}秒, 最大递归${SolverSafetyManager.maxRecursionDepth}层`);

    debugLog("🎯 马赛克拼图约束网格:");
    for (let r = 0; r < constraintGrid.length; r++) {
        const rowStr = constraintGrid[r].map(cell => cell === null ? '.' : cell).join(' ');
        debugLog(`   行${r}: ${rowStr}`);
    }

    if (stepByStep && puzzleData) {
        // 步骤模式暂时使用旧算法
        const rows = constraintGrid.length;
        const cols = constraintGrid[0].length;
        let solution = Array(rows).fill().map(() => Array(cols).fill(-1));

        stepSolverState = new MosaicStepController(solution, constraintGrid, puzzleData);
        debugLog("🎬 步骤演示模式已准备就绪（使用旧算法）");
        return solution;
    } else {
        // 使用新的CSP算法
        return solveMosaicCSP(constraintGrid, progressCallback);
    }
}

/**
 * 新的CSP求解主函数
 */
function solveMosaicCSP(constraintGrid, progressCallback = null) {
    debugLog("🚀 开始CSP求解...");

    // 创建CSP问题
    const csp = new MosaicCSP(constraintGrid);
    debugLog(`📊 创建了${csp.variables.size}个变量和${csp.constraints.size}个约束`);

    // 进度回调包装器
    const wrappedProgressCallback = progressCallback ? (solution) => {
        const totalCells = solution.length * solution[0].length;
        const resolvedCells = solution.flat().filter(cell => cell !== -1).length;
        const percentage = Math.round((resolvedCells / totalCells) * 100);

        debugLog(`📊 CSP进度: ${resolvedCells}/${totalCells} = ${percentage}%`);
        progressCallback(percentage, resolvedCells, totalCells);
    } : null;

    // 使用MAC算法求解
    const solution = macBacktrackSearch(csp, wrappedProgressCallback);

    if (solution) {
        debugLog("🎉 CSP算法成功解决拼图！");
        if (progressCallback) {
            const totalCells = solution.length * solution[0].length;
            progressCallback(100, totalCells, totalCells);
        }
        return solution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    } else {
        const reason = SolverSafetyManager.isTimeoutExceeded ? "超时" : "无解或达到安全限制";
        debugLog(`❌ CSP算法停止: ${reason}`);

        // 返回部分解
        const partialSolution = csp.toSolutionArray();
        if (progressCallback) {
            const totalCells = partialSolution.length * partialSolution[0].length;
            const resolvedCells = partialSolution.flat().filter(cell => cell !== -1).length;
            const percentage = Math.round((resolvedCells / totalCells) * 100);
            progressCallback(percentage, resolvedCells, totalCells);
        }
        return partialSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
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