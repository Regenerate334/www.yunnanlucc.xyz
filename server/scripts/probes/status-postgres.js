import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('[DB Check Warning] Failed to load .env file from:', envPath);
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

if (!dbConfig.user) {
    console.error('[DB Check Failed] DB_USER is not defined in environment or .env');
    process.exit(1);
}

const pool = new pg.Pool({
    ...dbConfig,
    connectionTimeoutMillis: 5000,
});

async function check() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        // console.log('[DB Check Success]');
    } catch (err) {
        console.error('[DB Check Failed]', err.message);
        process.exit(1); // Exit with error so PM2 turns RED
    }
}

// 首次检查
check();
// 每 30 秒检查一次
setInterval(check, 30000);
