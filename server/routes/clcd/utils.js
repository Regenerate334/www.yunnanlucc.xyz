/**
 * 业务模块路由 (Business Feature Routes)
 * 职责：负责 utils 相关业务接口的 URL 映射及请求派发。
 *
 * 修改提示：
 * 1. 路由内禁止堆叠复杂逻辑，严格践行"瘦路由、胖服务"的开发范式。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
/**
 * CLCD 模块工具函数
 * 包含分类映射、字段解析和 Jenks 自然断点算法
 */
import pool from '../../config/db.js';

// 土地利用分类映射
export const CLCD_CLASS_MAP = {
    1: 'Cropland', 2: 'Forest', 3: 'Shrub', 4: 'Grassland', 5: 'Water',
    6: 'Snow/Ice', 7: 'Barren', 8: 'Impervious', 9: 'Wetland'
};

// 属性名到数据库字段前缀的映射
export const ATTR_PREFIX_MAP = {
    cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
    water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
};

/**
 * 获取所有可用年份
 */
export async function getAvailableYears() {
    const { rows } = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
    return rows.map(r => r.year);
}

/**
 * 获取表的所有列名
 */
export async function getTableColumns(tableName) {
    const { rows } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);
    return rows.map(c => c.column_name);
}

/**
 * 根据年份解析数据库字段名
 * @param {number} year - 目标年份
 * @param {string} prefix - 属性前缀 (如 'cro')
 * @param {string[]} dbCols - 数据库列名列表
 * @param {number[]} years - 可用年份列表
 * @returns {string|null} 数据库字段名
 */
export function resolveFieldByYear(year, prefix, dbCols, years) {
    const yInt = Number(year);
    const targetColumnName = `${prefix}_${yInt}`;

    if (dbCols.includes(targetColumnName)) {
        return targetColumnName;
    }
    return null;
}

/**
 * Jenks 自然断点分类算法
 * @param {number[]} data - 已排序的数据数组
 * @param {number} n_classes - 分类数
 * @returns {number[]} 断点数组
 */
export function getJenksBreaks(data, n_classes) {
    if (n_classes > data.length) return data;

    data.sort((a, b) => a - b);

    const n = data.length;
    const mat1 = Array(n + 1).fill(null).map(() => Array(n_classes + 1).fill(1));
    const mat2 = Array(n + 1).fill(null).map(() => Array(n_classes + 1).fill(Infinity));
    mat2[0][0] = 0;

    for (let l = 2; l <= n; l++) {
        let s1 = 0, s2 = 0, w = 0;
        for (let m = 1; m <= l; m++) {
            const i3 = l - m + 1;
            const v = data[i3 - 1];
            w++;
            s1 += v;
            s2 += v * v;
            const variance = s2 - (s1 * s1) / w;
            if (i3 > 1) {
                for (let j = 2; j <= n_classes; j++) {
                    if (mat2[l][j] >= variance + mat2[i3 - 1][j - 1]) {
                        mat1[l][j] = i3;
                        mat2[l][j] = variance + mat2[i3 - 1][j - 1];
                    }
                }
            }
        }
        mat1[l][1] = 1;
        mat2[l][1] = s2 - (s1 * s1) / w;
    }

    const breaks = [data[0]];
    let k = n;
    for (let j = n_classes; j >= 2; j--) {
        const id = mat1[k][j] - 2;
        if (id >= 0 && id < data.length) {
            breaks.unshift(data[id]);
        }
        k = mat1[k][j] - 1;
    }
    breaks.push(data[n - 1]);

    return [...new Set(breaks)].sort((a, b) => a - b);
}
