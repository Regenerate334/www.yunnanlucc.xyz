import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

router.get('/transfer-matrix/periods', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT DISTINCT period FROM public.clcd_transfer_matrix ORDER BY period');
        res.json(rows.map(r => r.period));
    } catch (err) { handleError(res, err); }
});

router.get('/transfer-matrix/:period', async (req, res) => {
    const { period } = req.params;
    try {
        const { rows } = await pool.query(`SELECT * FROM public.clcd_transfer_matrix WHERE period = $1`, [period]);
        const matrix = {};
        const landTypes = new Set();
        rows.forEach(row => {
            landTypes.add(row.from_class);
            landTypes.add(row.to_class);
            if (!matrix[row.from_class]) matrix[row.from_class] = {};
            matrix[row.from_class][row.to_class] = Number(row.area);
        });
        const percentageMatrix = {};
        const types = Array.from(landTypes);
        types.forEach(from => {
            percentageMatrix[from] = {};
            let total = 0;
            types.forEach(to => { total += (matrix[from]?.[to] || 0); });
            types.forEach(to => {
                percentageMatrix[from][to] = total > 0 ? parseFloat(((matrix[from]?.[to] || 0) / total * 100).toFixed(2)) : 0;
            });
        });
        res.json({ absoluteMatrix: matrix, percentageMatrix, landTypes: types, period });
    } catch (err) { handleError(res, err); }
});

export default router;
