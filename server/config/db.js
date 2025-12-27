import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || 'yunnan_CLCD',
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
