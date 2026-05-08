/**\n * 业务模块路由 (Business Feature Routes)\n * 职责：负责 prefecture 相关业务接口的 URL 映射及请求派发。\n *\n * 修改提示：\n * 1. 路由内禁止堆叠复杂逻辑，严格践行"瘦路由、胖服务"的开发范式。\n * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。\n * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。\n */\n/**
 * 地级市数据路由
 * 端点：/prefecture, /prefecture/name/:name, /prefecture/year/:year
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';

const router = express.Router();

// 获取所有地级市数据
router.get('/', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_prefecture ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定地级市的全量时间序列数据
router.get('/name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取某年份所有地级市数据
router.get('/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE year = $1 ORDER BY region_name`;
        const { rows } = await pool.query(sql, [Number(year)]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

export default router;
