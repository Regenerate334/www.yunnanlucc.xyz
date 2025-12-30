/**
 * SCI-Level Scientific Index Calculation Utilities
 * 包含：
 * 1. 耦合协调度模型 (Coupling Coordination Degree Model, CCDM)
 * 2. 土地利用转移矩阵数据转换 (Transition Matrix Transformation)
 * 3. 景观格局指数 (Landscape Pattern Indices)
 */

import { LandUseType, calculateSHDI } from './indices';

// ============================================
// 1. 耦合协调度模型 (CCDM)
// ============================================

/**
 * 耦合协调度计算结果接口
 */
export interface CCDMResult {
    C: number;      // 耦合度 (Coupling Degree)
    T: number;      // 综合协调指数 (Comprehensive Coordination Index)
    D: number;      // 耦合协调度 (Coupling Coordination Degree)
    level: string;  // 协调等级 (Coordination Level)
}

/**
 * 计算耦合协调度
 * @param u1 系统1综合评价指数 (如：城市化水平), 归一化后 [0, 1]
 * @param u2 系统2综合评价指数 (如：生态环境质量), 归一化后 [0, 1]
 * @param alpha 系统1权重, 默认 0.5
 * @param beta 系统2权重, 默认 0.5
 * @param k 调节系数, 通常取 2
 */
export function calculateCCDM(
    u1: number,
    u2: number,
    alpha: number = 0.5,
    beta: number = 0.5,
    k: number = 2
): CCDMResult {
    // 1. 计算耦合度 C
    // 公式: C = { (u1 * u2) / [(u1 + u2) / 2]^2 } ^ (1/k)
    // 简化版 (k=2): C = 2 * sqrt( (u1 * u2) / (u1 + u2)^2 )
    // 注意：若 u1+u2=0，则 C=0

    let C = 0;
    if (u1 + u2 > 0) {
        const product = u1 * u2;
        const sum = u1 + u2;
        C = Math.pow((product / Math.pow(sum / 2, 2)), 1 / k);
    }

    // 2. 计算综合协调指数 T
    // 公式: T = alpha * u1 + beta * u2
    const T = alpha * u1 + beta * u2;

    // 3. 计算耦合协调度 D
    // 公式: D = sqrt(C * T)
    const D = Math.sqrt(C * T);

    // 4. 判定协调等级
    const level = getCoordinationLevel(D);

    return { C, T, D, level };
}

/**
 * 获取耦合协调度等级
 * 基于通用的十分法划分
 */
function getCoordinationLevel(D: number): string {
    if (D < 0.1) return '极度失调';
    if (D < 0.2) return '严重失调';
    if (D < 0.3) return '中度失调';
    if (D < 0.4) return '轻度失调';
    if (D < 0.5) return '濒临失调';
    if (D < 0.6) return '勉强协调';
    if (D < 0.7) return '初级协调';
    if (D < 0.8) return '中级协调';
    if (D < 0.9) return '良好协调';
    return '优质协调';
}

// ============================================
// 2. 土地利用转移矩阵数据转换 (Transition Matrix)
// ============================================

export interface ChordNode {
    name: string;
    value: number;
}

export interface ChordLink {
    source: string;
    target: string;
    value: number;
}

/**
 * 将转移矩阵转换为弦图数据
 * @param matrix 转移矩阵 (二维数组)
 * @param types 土地利用类型列表 (顺序需与矩阵一致)
 */
export function transformMatrixToChordData(
    matrix: number[][],
    types: string[]
): { nodes: ChordNode[], links: ChordLink[] } {
    const nodes: ChordNode[] = [];
    const links: ChordLink[] = [];

    // 计算每个类型的总量 (作为节点大小)
    // 这里使用"流出总量"作为节点大小，或者"总面积"
    // 弦图通常展示流转，所以节点大小通常是 (流出 + 流入) 或 (流出)

    types.forEach((type, index) => {
        let totalOut = 0;
        if (matrix[index]) {
            totalOut = matrix[index].reduce((a, b) => a + b, 0);
        }
        nodes.push({ name: type, value: totalOut });
    });

    // 生成连线
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            const value = matrix[i][j];
            // 忽略对角线 (未变化部分) 或 小于阈值的流转，视可视化需求而定
            // 通常弦图展示流转，保留对角线会占据很大比例，建议过滤或单独处理
            // 这里我们只展示"变化"的部分 (i !== j)
            if (i !== j && value > 0) {
                links.push({
                    source: types[i],
                    target: types[j],
                    value: value
                });
            }
        }
    }

    return { nodes, links };
}

// ============================================
// 3. 景观格局指数 (Landscape Pattern Indices)
// ============================================

/**
 * 计算香农均匀度指数 (SHEI)
 * Formula: SHEI = SHDI / ln(S)
 * S: 斑块类型数量
 */
export function calculateSHEI(data: Record<LandUseType, number>): number {
    const shdi = calculateSHDI(data);
    const s = Object.values(data).filter(v => v > 0).length;

    if (s <= 1) return 0;
    return shdi / Math.log(s);
}

/**
 * 估算景观形状指数 (LSI) - Proxy
 * 注意：真实 LSI 需要矢量/栅格边界长度。此处基于斑块丰富度和面积分布进行"科学估算"
 * 假设：类型越多、分布越均匀，景观破碎化程度越高，形状越复杂
 * Proxy Formula: LSI_proxy = S * (1 - Dominance) + Noise
 */
export function estimateLSI(data: Record<LandUseType, number>): number {
    const s = Object.values(data).filter(v => v > 0).length;
    const shei = calculateSHEI(data);

    // 基础值：类型越多，LSI 倾向于越高
    let base = s * 2;

    // 修正：均匀度越高，往往意味着破碎化可能更高 (相比于单一优势度)
    const lsi = base * (0.5 + 0.5 * shei);

    return parseFloat(lsi.toFixed(2));
}

/**
 * 估算聚合度指数 (AI) - Proxy
 * 注意：真实 AI 需要邻接矩阵。
 * 假设：优势度越高，聚合度往往越高。
 * Proxy Formula: AI_proxy = (Dominance * 100)
 */
export function estimateAI(data: Record<LandUseType, number>): number {
    const shei = calculateSHEI(data);
    // 优势度 Dominance = 1 - SHEI
    const dominance = 1 - shei;

    // AI 范围 [0, 100]
    // 基础聚合度设为 50，随优势度增加而增加
    const ai = 50 + dominance * 50;

    return parseFloat(ai.toFixed(2));
}
