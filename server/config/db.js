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
