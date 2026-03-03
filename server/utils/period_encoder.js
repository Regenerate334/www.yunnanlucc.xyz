/**
 * period_encoder.js
 * 将 (yearStart, yearEnd) 转换为数据库字段名前缀
 * 
 * 字段命名规则: y{period}_{fromClass}{toClass}
 * 例如: y8590_27 = 1985-1990年, 地类2 -> 地类7
 *
 * period 编码说明:
 *  - 年份取后2位: 1985 -> 85, 2000 -> 00
 *  - 1999 -> 2003 这样的特殊跨段编码为 y99003
 *  - 当年差 > 1年时通过多段累加或实际period字段匹配
 */

/**
 * 获取数据库中所有可用的 period 前缀列表
 * 通过查询 information_schema 动态获取
 * @param {pg.Pool} pool
 * @param {string} tableName
 * @returns {Promise<string[]>} 排序后的 period 列表, 如 ['y8590', 'y9091', 'y9899', 'y99003', ...]
 */
export async function getAvailablePeriods(pool, tableName) {
    const res = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name ~ '^y[0-9]'
        LIMIT 1000;
    `, [tableName]);

    const periodsSet = new Set();
    for (const row of res.rows) {
        const match = row.column_name.match(/^(y[^_]+)_\d+$/);
        if (match) periodsSet.add(match[1]);
    }

    return Array.from(periodsSet).sort();
}

/**
 * 解析 period 字符串为 [startYear, endYear]
 * 规则: y + 2位起始年 + 2位结束年 (有时结束年为3位, 如 y99003 = 1999-2003)
 * @param {string} period 如 'y8590', 'y9091', 'y99003', 'y0102'
 * @returns {[number, number]} [startYear, endYear]
 */
export function decodePeriod(period) {
    // Remove leading 'y'
    const raw = period.slice(1); // e.g. '8590', '9091', '99003', '0102'

    let startYY, endYY;

    if (raw.length === 5) {
        // Special case: e.g. '99003' => 1999-2003
        startYY = raw.slice(0, 2);
        endYY = raw.slice(2); // '003'
        const startYear = 1900 + parseInt(startYY);
        const endYear = 2000 + parseInt(endYY);
        return [startYear, endYear];
    } else if (raw.length === 4) {
        startYY = raw.slice(0, 2);
        endYY = raw.slice(2, 4);

        const startYYInt = parseInt(startYY);
        const endYYInt = parseInt(endYY);

        // 起始年: >= 85 -> 1900+, < 85 -> 2000+ (假设数据从1985开始)
        const startYear = startYYInt >= 85 ? 1900 + startYYInt : 2000 + startYYInt;

        // 结束年同理, 但必须 >= startYear
        let endYear = endYYInt >= 85 ? 1900 + endYYInt : 2000 + endYYInt;
        // 修正跨世纪: 如 y0001 = 2000-2001
        if (endYear < startYear) endYear += 100;

        return [startYear, endYear];
    }

    throw new Error(`Unknown period format: ${period}`);
}

/**
 * 找出覆盖 [yearStart, yearEnd] 区间的所有 period, 支持多段累加
 * @param {string[]} allPeriods 所有可用period列表
 * @param {number} yearStart 起始年份 (含)
 * @param {number} yearEnd   结束年份 (含)
 * @returns {string[]} 覆盖区间的period列表
 */
export function findOverlappingPeriods(allPeriods, yearStart, yearEnd) {
    const result = [];
    for (const period of allPeriods) {
        try {
            const [pStart, pEnd] = decodePeriod(period);
            // 如果period完全在 [yearStart, yearEnd] 范围内则包含
            if (pStart >= yearStart && pEnd <= yearEnd) {
                result.push(period);
            }
        } catch (e) {
            // skip unknown
        }
    }
    return result;
}

/**
 * 将 fromClass + toClass 转换为字段名后缀
 * 例如: fromClass=2, toClass=7 -> '27'
 * @param {number} fromClass 
 * @param {number} toClass 
 * @returns {string}
 */
export function encodeClassSuffix(fromClass, toClass) {
    return `${fromClass}${toClass}`;
}

/**
 * 生成所有需要 SUM 的字段名列表
 * @param {string[]} periods period列表
 * @param {number} fromClass
 * @param {number} toClass
 * @returns {string[]} 字段名列表, 如 ['y8590_27', 'y9091_27', ...]
 */
export function buildColumnNames(periods, fromClass, toClass) {
    const suffix = encodeClassSuffix(fromClass, toClass);
    return periods.map(p => `${p}_${suffix}`);
}
