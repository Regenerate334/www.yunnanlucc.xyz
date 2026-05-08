/**
 * PostgreSQL 数据库连接池配置 (Database Connection Pool)
 * 职责：建立与空间数据库（含 PostGIS）的持久化连接，提供高效的连接池管理。
 *
 * 修改提示：
 * 1. 连接池的 `max` 与 `idleTimeoutMillis` 参数应根据生产环境并发量动态调整。
 * 2. 所有对数据库的查询必须通过参数化 (e.g. `$1`, `$2`) 传递，严防 SQL 注入风险。
 * 3. 请确保 SSL 模式的配置与生产环境要求保持一致。
 */
import pg from 'pg';
import logger from './logger.js';

let currentConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

if (!currentConfig.host || !currentConfig.user || !currentConfig.password || !currentConfig.database) {
    logger.error('CRITICAL: Database environment variables are missing! Check .env file.');
}

let pool = new pg.Pool(currentConfig);

const poolProxy = {
    query: (...args) => pool.query(...args),
    connect: (...args) => pool.connect(...args),
    end: () => pool.end(),
    // Allow switching
    async switchAccount(user, password) {
        logger.info(`[db] Switching backend account to: ${user}`);
        await pool.end();
        currentConfig.user = user;
        if (password) currentConfig.password = password;
        pool = new pg.Pool(currentConfig);
        return true;
    },
    getCurrentUser: () => currentConfig.user
};

// Initial test
pool.connect((err, client, release) => {
    if (err) logger.error('[db] connection error:', { stack: err.stack });
    else {
        logger.info(`[db] connected successfully as ${currentConfig.user}`);
        release();
    }
});

export default poolProxy;
