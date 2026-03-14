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

import logger from '../config/logger.js';

class DataSourceRegistry {
    constructor() {
        /** @type {DataSourcePlugin[]} */
        this._sources = [];
    }

    /**
     * 注册一个数据源插件（工具）。
     * @param {Object} plugin
     * @param {string} plugin.name         - 工具名
     * @param {string} plugin.description  - 帮助 AI 理解该工具用途的描述
     * @param {Object} [plugin.parameters] - 符合 JSON Schema 规范的参数定义
     * @param {string[]} plugin.keywords   - (保留兼容) 触发关键词
     * @param {Function} plugin.query     - 执行逻辑
     */
    register(plugin) {
        if (!plugin.name || !plugin.query) {
            logger.warn(`[Registry] 插件注册失败，缺少必要字段 (name, query): ${plugin.name}`);
            return;
        }
        // 去重：同名插件只保留最后注册的
        this._sources = this._sources.filter(s => s.name !== plugin.name);
        this._sources.push(plugin);
        // 按优先级排序，或者通过 agent 调度。目前简单排序。
        this._sources.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        logger.info(`[Registry] 已注册数据工具: "${plugin.name}"`);
    }

    /**
     * 获取所有可供 AI 调出的工具描述列表。
     * 这里的输出格式兼容主流 LLM 的 Tool Calling 定义。
     */
    getToolSpecs() {
        return this._sources.map(s => ({
            type: 'function',
            function: {
                name: s.name,
                description: s.description,
                parameters: s.parameters || {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        }));
    }

    /**
     * 执行特定工具。
     */
    async callTool(name, args, entities = {}, year = 2023) {
        const source = this._sources.find(s => s.name === name);
        if (!source) throw new Error(`工具 "${name}" 未找到`);

        logger.info(`[Registry] 调用工具: "${name}", 参数: ${JSON.stringify(args)}`);
        try {
            const data = await source.query(args, entities, year);
            if (!data) return null;

            // 格式化输出
            if (typeof source.format === 'function') {
                return source.format(data, entities);
            }
            return defaultFormat(source.description || source.name, data);
        } catch (err) {
            logger.error(`[Registry] 工具 "${name}" 运行异常: ${err.message}`);
            throw err;
        }
    }

    /**
     * (保留旧逻辑兼容) 查找匹配问题的第一个插件。
     */
    findMatch(question) {
        if (!question) return null;
        return this._sources.find(s =>
            s.keywords && s.keywords.some(kw => question.includes(kw))
        ) || null;
    }

    async queryIfMatch(question, entities, year) {
        const plugin = this.findMatch(question);
        if (!plugin) return null;

        logger.info(`[Registry] 命中旧版插件匹配: "${plugin.name}"`);
        return this.callTool(plugin.name, {}, entities, year);
    }

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
 */
function defaultFormat(title, data) {
    const rows = data.rows || (Array.isArray(data) ? data : []);
    if (rows.length === 0) {
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
    const timeInfo = data.year ? `（年份：${data.year}）` : (data.period ? `（时段：${data.period}）` : '');

    return [
        `## 数据背景：${title}${extra}${timeInfo}`,
        '',
        header,
        sep,
        ...dataRows,
        rows.length > 100 ? `\n> 共 ${rows.length} 条，仅展示前 100 条。` : ''
    ].join('\n');
}

// 全局单例
export const registry = new DataSourceRegistry();
export default registry;
