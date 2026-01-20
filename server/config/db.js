import pg from 'pg';

// 环境变量由 server/index.js 统一加载
const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'yunnan_CLCD',
    max: 10
});

// 测试连接
pool.connect((err, client, release) => {
    if (err) {
        console.error('\x1b[31m[db] connection error:\x1b[0m', err.stack);
    } else {
        console.log('\x1b[32m[db] connected successfully\x1b[0m');
        release();
    }
});

export default pool;
