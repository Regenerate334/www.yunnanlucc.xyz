/**
 * DataSourceRegistry — 数据源插件注册中心
 *
 * 架构思想：
 *   核心路由（dataRouter.js）只负责 CLCD 土地利用的快速路由，
 *   所有其他数据类型（土地流转、气象、经济等）通过此注册中心以"插件"形式接入。
 *
 *   添加新数据源的步骤：
 *     1. 在 server/utils/dataSources/ 目录下新建一个 .js 文件
 *     2. 文件中调用 registry.register({ ... }) 即可
 *     3. 在 server/index.js 中 import 一次该文件（让注册代码执行）
 *     4. 完成！dataRouter 会自动在需要时调用你的数据源
 *
 * 示例插件结构：
 *   registry.register({
 *     name: 'land_transfer',          // 唯一标识
 *     description: '土地利用转移矩阵数据',
 *     keywords: ['流转', '转移', '转化'],  // 触发关键词（中文）
 *     priority: 10,                   // 优先级（数字越大越先匹配）
 *     async query(question, entities, year) {
 *       // 执行数据库查询，返回 { type, rows, region? }
 *     },
 *     format(data, entities)  {       // 可选，自定义格式化
 *       // 返回 Markdown 字符串
 *     }
 *   });
 */

class DataSourceRegistry {
    constructor() {
        /** @type {DataSourcePlugin[]} */
        this._sources = [];
    }

    /**
     * 注册一个数据源插件。
     * @param {DataSourcePlugin} plugin
     */
    register(plugin) {
        if (!plugin.name || !plugin.keywords || !plugin.query) {
            console.warn('[Registry] 插件注册失败，缺少必要字段 (name, keywords, query):', plugin.name);
            return;
        }
        // 去重：同名插件只保留最后注册的
        this._sources = this._sources.filter(s => s.name !== plugin.name);
        this._sources.push(plugin);
        // 按优先级从高到低排序
        this._sources.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        console.log(`[Registry] 已注册数据源插件: "${plugin.name}" (关键词: ${plugin.keywords.join(', ')})`);
    }

    /**
     * 查找匹配问题的第一个插件。
     * @param {string} question
     * @returns {DataSourcePlugin|null}
     */
    findMatch(question) {
        if (!question) return null;
        return this._sources.find(s =>
            s.keywords.some(kw => question.includes(kw))
        ) || null;
    }

    /**
     * 如果问题命中某插件，执行其查询并返回 Markdown 上下文字符串。
     * @param {string} question
     * @param {object} entities   EntityExtractor 提取的实体
     * @param {number} year
     * @returns {Promise<string|null>}  null 表示没有插件命中
     */
    async queryIfMatch(question, entities, year) {
        const plugin = this.findMatch(question);
        if (!plugin) return null;

        console.log(`[Registry] 命中插件: "${plugin.name}"`);
        try {
            const data = await plugin.query(question, entities, year);
            if (!data) return null;

            // 优先使用插件自身的格式化方法
            if (typeof plugin.format === 'function') {
                return plugin.format(data, entities);
            }

            // 默认格式化：把 rows 转为 Markdown 表格
            return defaultFormat(plugin.description || plugin.name, data);

        } catch (err) {
            console.error(`[Registry] 插件 "${plugin.name}" 查询失败:`, err.message);
            return null;
        }
    }

    /**
     * 列出所有已注册的插件（用于调试）。
     */
    list() {
        return this._sources.map(s => ({
            name: s.name,
            description: s.description,
            keywords: s.keywords,
            priority: s.priority || 0
        }));
    }
}

/**
 * 默认表格格式化器。
 * @param {string} title
 * @param {{ rows: object[], type?: string, region?: string }} data
 * @returns {string}
 */
function defaultFormat(title, data) {
    const rows = data.rows || data;
    if (!Array.isArray(rows) || rows.length === 0) {
        return `> ${title}：暂无相关数据。`;
    }

    const keys = Object.keys(rows[0]);
    const header = `| ${keys.join(' | ')} |`;
    const sep = `|${keys.map(() => '---').join('|')}|`;
    const dataRows = rows.slice(0, 100).map(r => {
        const cells = keys.map(k => {
            const v = r[k];
            if (v === null || v === undefined) return '—';
            if (typeof v === 'number') {
                return v >= 10000
                    ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
                    : String(parseFloat(v.toFixed(4)));
            }
            return String(v);
        });
        return `| ${cells.join(' | ')} |`;
    });

    const extra = data.region ? `（区域：${data.region}）` : '';
    return [
        `## 数据背景：${title}${extra}`,
        '',
        header,
        sep,
        ...dataRows,
        rows.length > 100 ? `\n> 共 ${rows.length} 条，仅展示前 100 条。` : ''
    ].join('\n');
}

// 全局单例，在整个服务端共享
export const registry = new DataSourceRegistry();
export default registry;
