import pool from './server/config/db.js';

async function restorePassword() {
    try {
        // 这是我在 Step 719 记录到的您原始的哈希值
        const originalHash = '$2b$10$PQNCfMVoijFPqttWMg.U1qWSOc9Hn6PXwp9o';

        await pool.query('UPDATE users SET password = $1 WHERE username = \'admin\'', [originalHash]);
        console.log('已成功恢复原始密码哈希。');
        process.exit(0);
    } catch (err) {
        console.error('恢复失败:', err);
        process.exit(1);
    }
}

restorePassword();
