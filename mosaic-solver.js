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

// 马赛克拼图约束传播算法
// 输入: 2D数组，数字表示约束，null表示无约束
// 输出: 2D数组，1表示填充，0表示空白，-1表示未知
function solveMosaicAlgorithm(constraintGrid, stepByStep = false, puzzleData = null) {
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
        return mosaicConstraintPropagation(solution, constraintGrid);
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

// 旧的8邻居函数（保留用于兼容性）
function getNeighborPositions(row, col, rows, cols) {
    const neighbors = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    directions.forEach(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
            neighbors.push([newRow, newCol]);
        }
    });

    return neighbors;
}


// 马赛克约束传播主函数（增强版，包含回溯搜索）
function mosaicConstraintPropagation(solution, constraintGrid) {
    debugLog("🧠 开始马赛克增强求解算法...");

    // 首先尝试纯约束传播
    const basicSolution = basicConstraintPropagation(solution, constraintGrid);

    // 检查是否完全求解
    if (isCompletelyResolved(basicSolution)) {
        debugLog("🎉 纯约束传播成功解决拼图！");
        return basicSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    }

    // 如果约束传播无法完全解决，使用回溯搜索
    debugLog("🔍 约束传播未能完全解决，启动回溯搜索...");
    const backtrackSolution = backtrackSolve(basicSolution, constraintGrid);

    if (backtrackSolution) {
        debugLog("🎉 回溯搜索成功解决拼图！");
        return backtrackSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    } else {
        debugLog("❌ 回溯搜索也无法解决此拼图");
        return basicSolution.map(row => row.map(cell => cell === -1 ? 0 : cell));
    }
}


// 基础约束传播（原来的逻辑）
function basicConstraintPropagation(solution, constraintGrid) {
    let iterationCount = 0;
    let changed = true;
    const workingSolution = solution.map(row => [...row]);

    while (changed) {
        iterationCount++;
        debugLog(`🔄 基础约束传播迭代 ${iterationCount}`);

        changed = analyzeConstraints(constraintGrid, workingSolution);

        if (!changed) {
            debugLog("🏁 基础约束传播收敛");
            break;
        }

        // 防止无限循环
        if (iterationCount > 100) {
            debugLog("⚠️ 达到最大迭代次数，停止基础传播");
            break;
        }
    }

    debugLog(`✅ 基础约束传播完成，共进行 ${iterationCount} 次迭代`);
    return workingSolution;
}

// 检查解是否完全确定
function isCompletelyResolved(solution) {
    return solution.every(row => row.every(cell => cell !== -1));
}


// 回溯搜索算法
function backtrackSolve(solution, constraintGrid) {
    // 创建工作副本
    const workingSolution = solution.map(row => [...row]);

    // 查找第一个未确定的单元格
    const unknownCell = findFirstUnknownCell(workingSolution);
    if (!unknownCell) {
        // 没有未知单元格，检查解是否有效
        return isValidSolution(workingSolution, constraintGrid) ? workingSolution : null;
    }

    const [row, col] = unknownCell;
    debugLog(`🎯 回溯搜索尝试单元格 (${row}, ${col})`);

    // 尝试填充 (1) 和空白 (0)
    for (const value of [1, 0]) {
        debugLog(`   尝试值: ${value === 1 ? '填充' : '空白'}`);

        // 设置假设值
        workingSolution[row][col] = value;

        // 检查当前假设是否与约束冲突
        if (isConsistentWithConstraints(workingSolution, constraintGrid)) {
            // 应用约束传播
            const propagatedSolution = basicConstraintPropagation(workingSolution, constraintGrid);

            // 检查传播后是否仍然一致
            if (isConsistentWithConstraints(propagatedSolution, constraintGrid)) {
                // 递归求解
                const result = backtrackSolve(propagatedSolution, constraintGrid);
                if (result) {
                    return result;
                }
            }
        }

        // 回溯：撤销假设
        workingSolution[row][col] = -1;
    }

    debugLog(`❌ 单元格 (${row}, ${col}) 的所有假设都失败`);
    return null;
}

// 查找第一个未确定的单元格
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