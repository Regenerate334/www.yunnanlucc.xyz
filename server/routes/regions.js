import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

router.get('/:level', async (req, res) => {
    const { level } = req.params;
    try {
        const tableName = level === 'prefecture' ? 'public.clcd_prefecture' : 'public.clcd_county';
        const sql = `SELECT DISTINCT region_name FROM ${tableName} ORDER BY region_name ASC`;
        const { rows } = await pool.query(sql);
        res.json(rows.map(r => r.region_name));
    } catch (err) { handleError(res, err); }
});

export default router;
