/**
 * SchemaDiscovery — 数据库 Schema 自动发现模块
 *
 * 职责：
 *   1. 启动时扫描 PostgreSQL 中所有业务表（排除 PostGIS 系统表）
 *   2. 为每张表获取字段列表、注释、示例数据
 *   3. 生成供 AI 使用的 schema 摘要文本（注入进 system prompt）
 *   4. 支持热刷新（新增表后调用 refresh() 无需重启服务）
 *
 * 使用方法：
 *   import schemaDiscovery from './schemaDiscovery.js';
 *   await schemaDiscovery.init();          // 服务启动时调用一次
 *   const summary = schemaDiscovery.getSummary();  // 获取 AI 可读摘要
 *   await schemaDiscovery.refresh();       // 热刷新（新增表后调用）
 */

import pool from '../config/db.js';
import logger from '../config/logger.js';

// ── 系统表/视图黑名单（这些表不暴露给 AI）────────────────────────────────────
const SYSTEM_TABLE_PREFIXES = [
    'pg_', 'sql_', 'information_schema',
    'geography_columns', 'geometry_columns',
    'raster_columns', 'raster_overviews',
    'spatial_ref_sys', 'topology'
];

// 已知空间/几何字段名（排除在 schema 摘要里，避免污染 AI 上下文）
const GEOMETRY_COLUMN_NAMES = ['geom', 'geometry', 'the_geom', 'wkb_geometry', 'shape'];

// ── 字段类型到可读类型的映射 ─────────────────────────────────────────────────
const TYPE_ALIAS = {
    'integer': 'INT', 'bigint': 'INT', 'smallint': 'INT', 'numeric': 'FLOAT',
    'double precision': 'FLOAT', 'real': 'FLOAT', 'character varying': 'TEXT',
    'character': 'TEXT', 'text': 'TEXT', 'boolean': 'BOOL',
    'timestamp without time zone': 'TIMESTAMP', 'timestamp with time zone': 'TIMESTAMP',
    'date': 'DATE', 'json': 'JSON', 'jsonb': 'JSON', 'USER-DEFINED': 'GEOMETRY'
};

// ── 内存缓存 ─────────────────────────────────────────────────────────────────
let _cache = {
    tables: [],        // Array<TableInfo>
    summary: '',       // 给 AI 的 schema 摘要文本
    lastRefreshed: null
};

/**
 * 扫描数据库，构建 schema 缓存。
 * @returns {Promise<void>}
 */
async function refresh() {
    logger.info('[SchemaDiscovery] 开始扫描数据库 schema...');
    const startAt = Date.now();

    try {
        // 1. 获取所有用户表列表（排除系统表和视图中的几何表）
        const tableRes = await pool.query(`
            SELECT
                t.table_name,
                obj_description(c.oid, 'pg_class') AS table_comment
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            WHERE t.table_schema = 'public'
              AND t.table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY t.table_name;
        `);

        // 过滤掉系统表前缀
        const userTables = tableRes.rows.filter(r =>
            !SYSTEM_TABLE_PREFIXES.some(prefix => r.table_name.startsWith(prefix))
        );

        // 2. 对每张表获取字段信息和示例数据
        const tables = [];
        for (const t of userTables) {
            const tableInfo = await inspectTable(t.table_name, t.table_comment);
            if (tableInfo) tables.push(tableInfo);
        }

        // 3. 生成摘要文本
        const summary = buildSummary(tables);

        _cache = {
            tables,
            summary,
            lastRefreshed: new Date().toISOString()
        };

        const elapsed = Date.now() - startAt;
        logger.info(`[SchemaDiscovery] 发现 ${tables.length} 张表，耗时 ${elapsed}ms`);

    } catch (err) {
        logger.error(`[SchemaDiscovery] 扫描失败: ${err.message}`);
        // 不抛出，降级为空摘要——AI 仍可以照常工作，只是没有 schema 提示
    }
}

/**
 * 检查单张表的字段信息和样本数据。
 * @param {string} tableName
 * @param {string|null} tableComment
 * @returns {Promise<TableInfo|null>}
 */
async function inspectTable(tableName, tableComment) {
    try {
        // 获取字段信息
        const colRes = await pool.query(`
            SELECT
                column_name,
                data_type,
                col_description(c.oid, a.attnum) AS col_comment
            FROM information_schema.columns col
            LEFT JOIN pg_class c ON c.relname = col.table_name AND c.relnamespace = 'public'::regnamespace
            LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = col.column_name
            WHERE col.table_schema = 'public'
              AND col.table_name = $1
            ORDER BY col.ordinal_position;
        `, [tableName]);

        // 过滤掉几何字段（对 AI 无意义且体积巨大）
        const columns = colRes.rows.filter(
            c => !GEOMETRY_COLUMN_NAMES.includes(c.column_name.toLowerCase())
                && c.data_type !== 'USER-DEFINED'
        );

        if (columns.length === 0) {
            // 纯几何表，跳过
            return null;
        }

        // 获取行数（近似，使用 pg_stat）
        const countRes = await pool.query(`
            SELECT reltuples::bigint AS approx_count
            FROM pg_class
            WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
        `, [tableName]);
        const rowCount = Number(countRes.rows[0]?.approx_count ?? 0);

        // 取最多 2 行示例数据（只选非几何字段，避免溢出）
        const safeCols = columns.map(c => `"${c.column_name}"`).join(', ');
        let sampleRows = [];
        try {
            const sampleRes = await pool.query(
                `SELECT ${safeCols} FROM public."${tableName}" LIMIT 2`
            );
            sampleRows = sampleRes.rows;
        } catch (_) {
            // 视图或无权限表忽略
        }

        return {
            name: tableName,
            comment: tableComment || '',
            rowCount,
            columns: columns.map(c => ({
                name: c.column_name,
                type: TYPE_ALIAS[c.data_type] || c.data_type,
                comment: c.col_comment || ''
            })),
            sampleRows
        };
    } catch (err) {
        logger.warn(`[SchemaDiscovery] 表 ${tableName} 检查失败: ${err.message}`);
        return null;
    }
}

/**
 * 将表列表构建为给 AI 的摘要文本。
 * 格式尽量紧凑，以节省 token。
 * @param {Array<TableInfo>} tables
 * @returns {string}
 */
function buildSummary(tables) {
    if (tables.length === 0) return '';

    const lines = [
        '## 可用数据库表（AI 可通过 SQL 查询以下表）',
        ''
    ];

    for (const t of tables) {
        const rowInfo = t.rowCount > 0 ? `约 ${t.rowCount.toLocaleString()} 行` : '';
        lines.push(`### 表: \`${t.name}\` ${t.comment ? `— ${t.comment}` : ''} ${rowInfo}`);

        // 字段列表
        const fieldLines = t.columns.map(c => {
            const comment = c.comment ? ` (${c.comment})` : '';
            return `  - \`${c.name}\` [${c.type}]${comment}`;
        });
        lines.push(...fieldLines);

        // 示例数据（最多 1 行）
        if (t.sampleRows.length > 0) {
            const sample = JSON.stringify(t.sampleRows[0]);
            lines.push(`  - 示例: ${sample}`);
        }

        lines.push('');
    }

    lines.push('> **注意**: 单次 SQL 查询结果限制 200 行，只允许 SELECT 查询。');
    return lines.join('\n');
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

/**
 * 初始化（服务启动时调用一次）。
 */
async function init() {
    await refresh();
}

/**
 * 获取当前缓存的 schema 摘要（供注入 AI system prompt）。
 * @returns {string}
 */
function getSummary() {
    return _cache.summary;
}

/**
 * 获取所有已发现的表名列表（用于 SQL 白名单校验）。
 * @returns {string[]}
 */
function getTableNames() {
    return _cache.tables.map(t => t.name);
}

/**
 * 获取指定表的字段名列表（用于 SQL 白名单校验）。
 * @param {string} tableName
 * @returns {string[]}
 */
function getColumnNames(tableName) {
    const t = _cache.tables.find(t => t.name === tableName);
    return t ? t.columns.map(c => c.name) : [];
}

/**
 * 获取缓存元信息（用于 /api/ai/schema 端点调试）。
 * @returns {object}
 */
function getMeta() {
    return {
        tableCount: _cache.tables.length,
        tables: _cache.tables.map(t => ({
            name: t.name,
            comment: t.comment,
            rowCount: t.rowCount,
            columnCount: t.columns.length
        })),
        lastRefreshed: _cache.lastRefreshed
    };
}

/**
 * 获取指定表的完整信息（含 columns 详情）。
 * @param {string} tableName
 * @returns {object|null}
 */
function getTableInfo(tableName) {
    return _cache.tables.find(t => t.name === tableName) || null;
}

export default { init, refresh, getSummary, getTableNames, getColumnNames, getTableInfo, getMeta };
